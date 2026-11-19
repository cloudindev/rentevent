import "server-only";
import {
  and,
  asc,
  assignments,
  contacts,
  desc,
  emails,
  emailTemplates,
  eq,
  gte,
  inArray,
  items,
  lt,
  orders,
  quotes,
  shifts,
  systemDb,
  organization,
  tenantSettings,
  withTenant,
  workers,
  workflowRuns,
  workflows,
  type Tx,
} from "@rentevent/db";
import { checkOrderAvailability, expireOptions } from "@rentevent/db/services";
import { addDays, dayKey, parseDayKey, zonedTime } from "@rentevent/core";
import { notify, type Channel } from "@/lib/adapters/messaging";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/adapters/email";
import { env } from "@/lib/env";
import type { AppContext } from "../context";
import { evaluateConditions, renderTemplate, type Condition } from "./logic";

export * from "./logic";

export const TRIGGERS = {
  pedido_creado: "Pedido creado",
  pedido_confirmado: "Pedido confirmado",
  opcion_por_caducar: "Opción a punto de caducar (48 h)",
  escasez_detectada: "Escasez de material detectada",
  devolucion_manana: "Devolución mañana",
  diario: "Cada día",
  semanal: "Cada semana",
} as const;
export type Trigger = keyof typeof TRIGGERS;
/** legacy spelling accepted on read */
export const normalizeTrigger = (t: string): Trigger => (t === "devolucion_mañana" ? "devolucion_manana" : (t as Trigger));

export const ACTIONS = {
  caducar_opciones: "Caducar opciones vencidas",
  avisar_escasez: "Avisar de escasez de material",
  enviar_plantilla: "Enviar plantilla de correo",
  publicar_planning: "Publicar el planning de la semana",
  notificar: "Enviar notificación",
} as const;
export type ActionType = keyof typeof ACTIONS;

export type WorkflowAction =
  | { type: "caducar_opciones" }
  | { type: "avisar_escasez"; channel: Channel; to: string }
  | { type: "enviar_plantilla"; template: string; to?: string }
  | { type: "publicar_planning"; channel: Channel }
  | { type: "notificar"; channel: Channel; to: string; title: string; body: string };

export type EntityRef = { type: "order"; id: string } | null;
type RunResult = { workflowId: string; status: "ok" | "omitido" | "error"; detail: string; entityId: string | null };

const ENTITY_ACTIONS: ActionType[] = ["enviar_plantilla", "notificar"];
const DAY = 86_400_000;

const fmt = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d) : "";

/** Variables available to conditions and templates for an order. */
export async function orderContext(tx: Tx, orderId: string): Promise<Record<string, string | number>> {
  const [o] = await tx
    .select({ o: orders, client: contacts.name, email: contacts.email })
    .from(orders)
    .leftJoin(contacts, eq(contacts.id, orders.clientId))
    .where(eq(orders.id, orderId));
  if (!o) return {};
  const [q] = await tx.select().from(quotes).where(eq(quotes.orderId, orderId)).orderBy(desc(quotes.version)).limit(1);
  const [s] = await tx.select({ legalName: tenantSettings.legalName }).from(tenantSettings);
  const [org] = await tx.select({ name: organization.name }).from(organization);
  const today = dayKey(Date.now());
  const daysTo = (d: Date) => {
    const [y1, m1, d1] = parseDayKey(today);
    const [y2, m2, d2] = parseDayKey(dayKey(d.getTime()));
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
  };
  return {
    pedido: o.o.number,
    titulo: o.o.title,
    evento: o.o.title,
    cliente: o.client ?? "",
    email_cliente: o.email ?? "",
    estado: o.o.status,
    total: q ? Number(q.total) : 0,
    montaje: fmt(o.o.periodStart),
    retorno: fmt(o.o.periodEnd),
    dias_para_carga: daysTo(o.o.periodStart),
    dias_para_retorno: daysTo(o.o.periodEnd),
    empresa: org?.name ?? s?.legalName ?? "",
    enlace: q ? `${env.appUrl}/p/presupuesto/${q.publicToken}` : `${env.appUrl}/app/pedidos/${o.o.id}`,
  };
}

async function shortagesText(tx: Tx, orderIds: string[]) {
  const lines: string[] = [];
  for (const id of orderIds) {
    const checks = (await checkOrderAvailability(tx, id)).filter((c) => c.shortage > 0);
    if (!checks.length) continue;
    const [o] = await tx.select({ number: orders.number, title: orders.title }).from(orders).where(eq(orders.id, id));
    const names = await tx.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, checks.map((c) => c.itemId)));
    lines.push(`${o?.number} ${o?.title}: ${checks.map((c) => `faltan ${c.shortage} ${names.find((n) => n.id === c.itemId)?.name ?? ""}`).join(", ")}`);
  }
  return lines;
}

async function executeAction(tx: Tx, action: WorkflowAction, vars: Record<string, string | number>, entity: EntityRef): Promise<{ status: "ok" | "omitido"; detail: string }> {
  switch (action.type) {
    case "caducar_opciones": {
      const n = await expireOptions(tx);
      return { status: "ok", detail: n.length ? `${n.length} opción(es) caducada(s): ${n.map((x) => x.number).join(", ")}` : "No había opciones vencidas" };
    }
    case "avisar_escasez": {
      const ids = entity
        ? [entity.id]
        : (await tx.select({ id: orders.id }).from(orders).where(and(inArray(orders.status, ["confirmado", "opcion", "consulta"]), gte(orders.periodEnd, new Date()), lt(orders.periodStart, new Date(Date.now() + 60 * DAY))))).map((r) => r.id);
      const lines = await shortagesText(tx, ids);
      if (!lines.length) return { status: "omitido", detail: "Sin escasez de material" };
      await notify(tx, { channel: action.channel, recipient: action.to, title: "Escasez de material", body: lines.join("\n"), entity: entity ? "order" : undefined, entityId: entity?.id, url: `${env.appUrl}/app/carpas/ocupacion` });
      return { status: "ok", detail: `Aviso enviado a ${action.to}: ${lines.length} pedido(s) con escasez` };
    }
    case "enviar_plantilla": {
      const [tpl] = await tx.select().from(emailTemplates).where(eq(emailTemplates.key, action.template));
      if (!tpl) return { status: "omitido", detail: `No existe la plantilla «${action.template}»` };
      const to = action.to ? renderTemplate(action.to, vars) : String(vars.email_cliente ?? "");
      if (!to) return { status: "omitido", detail: "El cliente no tiene correo" };
      const subject = renderTemplate(tpl.subject, vars);
      const body = renderTemplate(tpl.body, vars);
      await sendEmail({ to, subject, html: emailLayout({ title: subject, body: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`, footer: String(vars.empresa ?? "") }), text: body });
      const [s] = await tx.select({ email: tenantSettings.email }).from(tenantSettings);
      await tx.insert(emails).values({ direction: "saliente", fromAddress: s?.email || "no-reply@rentevent.es", toAddress: to, subject, body, entity: entity ? "order" : null, entityId: entity?.id ?? null, read: true });
      return { status: "ok", detail: `Correo «${subject}» enviado a ${to}` };
    }
    case "publicar_planning": {
      const today = dayKey(Date.now());
      const [y, m, d] = parseDayKey(today);
      const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      const mon = addDays(today, 7 - dow);
      const [ya, ma, da] = parseDayKey(mon);
      const [yb, mb, db] = parseDayKey(addDays(mon, 7));
      const from = new Date(zonedTime(ya, ma, da));
      const to = new Date(zonedTime(yb, mb, db));
      const week = await tx.update(shifts).set({ published: true }).where(and(gte(shifts.startsAt, from), lt(shifts.startsAt, to))).returning({ id: shifts.id });
      if (!week.length) return { status: "omitido", detail: "No hay turnos la semana que viene" };
      const people = await tx
        .selectDistinct({ id: workers.id, name: workers.name, email: workers.email, userId: workers.userId })
        .from(assignments)
        .innerJoin(workers, eq(workers.id, assignments.workerId))
        .where(inArray(assignments.shiftId, week.map((w) => w.id)));
      for (const p of people) {
        await notify(tx, { channel: action.channel, recipient: action.channel === "email" ? p.email ?? p.name : p.name, userId: p.userId, title: "Planning publicado", body: `Ya tienes tu planning de la semana del ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(from)}.`, url: `${env.appUrl}/m` });
      }
      return { status: "ok", detail: `${week.length} turno(s) publicados y ${people.length} trabajador(es) avisados` };
    }
    case "notificar": {
      const to = renderTemplate(action.to, vars);
      if (!to) return { status: "omitido", detail: "Sin destinatario" };
      await notify(tx, { channel: action.channel, recipient: to, title: renderTemplate(action.title, vars), body: renderTemplate(action.body, vars), entity: entity ? "order" : undefined, entityId: entity?.id });
      return { status: "ok", detail: `Notificación ${action.channel} a ${to}` };
    }
  }
}

type WorkflowRow = typeof workflows.$inferSelect;

async function runOne(tx: Tx, wf: WorkflowRow, entity: EntityRef): Promise<RunResult> {
  const action = wf.action as WorkflowAction;
  const conditions = (wf.conditions as Condition[]) ?? [];
  let vars: Record<string, string | number> = {};
  try {
    if (entity) vars = await orderContext(tx, entity.id);
    if (!evaluateConditions(conditions, vars)) return { workflowId: wf.id, status: "omitido", detail: "No cumple las condiciones", entityId: entity?.id ?? null };
    const r = await executeAction(tx, action, vars, entity);
    await tx.insert(workflowRuns).values({ workflowId: wf.id, status: r.status, detail: r.detail, entity: entity?.type ?? null, entityId: entity?.id ?? null });
    return { workflowId: wf.id, ...r, entityId: entity?.id ?? null };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await tx.insert(workflowRuns).values({ workflowId: wf.id, status: "error", detail: detail.slice(0, 1000), entity: entity?.type ?? null, entityId: entity?.id ?? null });
    return { workflowId: wf.id, status: "error", detail, entityId: entity?.id ?? null };
  }
}

/** Candidate orders for scheduled / manual runs of entity-oriented workflows. */
async function candidates(tx: Tx, trigger: Trigger): Promise<string[]> {
  const now = Date.now();
  if (trigger === "devolucion_manana") {
    const tomorrow = addDays(dayKey(now), 1);
    const [y, m, d] = parseDayKey(tomorrow);
    const [y2, m2, d2] = parseDayKey(addDays(tomorrow, 1));
    return (await tx.select({ id: orders.id }).from(orders).where(and(inArray(orders.status, ["confirmado", "en_curso"]), gte(orders.periodEnd, new Date(zonedTime(y, m, d))), lt(orders.periodEnd, new Date(zonedTime(y2, m2, d2)))))).map((r) => r.id);
  }
  if (trigger === "opcion_por_caducar") {
    return (await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.status, "opcion"), gte(orders.optionExpiresAt, new Date(now)), lt(orders.optionExpiresAt, new Date(now + 2 * DAY))))).map((r) => r.id);
  }
  return (
    await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(inArray(orders.status, ["consulta", "opcion", "confirmado", "en_curso"]), gte(orders.periodEnd, new Date(now - DAY))))
      .orderBy(asc(orders.periodStart))
      .limit(200)
  ).map((r) => r.id);
}

async function runForCandidates(tx: Tx, wf: WorkflowRow): Promise<RunResult[]> {
  const trigger = normalizeTrigger(wf.trigger);
  const action = wf.action as WorkflowAction;
  const entityBased = ENTITY_ACTIONS.includes(action.type) || ["devolucion_manana", "opcion_por_caducar"].includes(trigger);
  if (trigger === "escasez_detectada") return [await runOne(tx, wf, null)];
  if (!entityBased) return [await runOne(tx, wf, null)];
  const ids = await candidates(tx, trigger);
  const out: RunResult[] = [];
  for (const id of ids) {
    const vars = await orderContext(tx, id);
    if (!evaluateConditions((wf.conditions as Condition[]) ?? [], vars)) continue;
    out.push(await runOne(tx, wf, { type: "order", id }));
  }
  if (out.length === 0) {
    await tx.insert(workflowRuns).values({ workflowId: wf.id, status: "omitido", detail: "Ningún pedido cumple las condiciones" });
    out.push({ workflowId: wf.id, status: "omitido", detail: "Ningún pedido cumple las condiciones", entityId: null });
  }
  return out;
}

/**
 * Event hook for other modules: runs every active workflow with this trigger
 * for the entity (e.g. `pedido_confirmado` for an order). Errors are logged in
 * the run log and never thrown to the caller.
 */
export async function runWorkflowsFor(tx: Tx, ctx: Pick<AppContext, "user"> | null, trigger: Trigger, entity: EntityRef): Promise<RunResult[]> {
  void ctx;
  const list = await tx.select().from(workflows).where(eq(workflows.active, true));
  const out: RunResult[] = [];
  for (const wf of list.filter((w) => normalizeTrigger(w.trigger) === trigger)) {
    out.push(await runOne(tx, wf, entity));
    await tx.update(workflows).set({ lastRunAt: new Date() }).where(eq(workflows.id, wf.id));
  }
  return out;
}

/** "Ejecutar ahora" and the `workflow` job. */
export async function runWorkflowById(tenantId: string, workflowId: string, entity: EntityRef) {
  return withTenant(tenantId, async (tx) => {
    const [wf] = await tx.select().from(workflows).where(eq(workflows.id, workflowId));
    if (!wf) throw new Error("Workflow no encontrado");
    const res = entity ? [await runOne(tx, wf, entity)] : await runForCandidates(tx, wf);
    await tx.update(workflows).set({ lastRunAt: new Date() }).where(eq(workflows.id, wf.id));
    return res;
  });
}

const SCHEDULE_MS: Partial<Record<Trigger, number>> = {
  diario: 20 * 3600_000,
  devolucion_manana: 20 * 3600_000,
  opcion_por_caducar: 20 * 3600_000,
  escasez_detectada: 20 * 3600_000,
  semanal: 6.5 * DAY,
};

/** Runs due scheduled workflows of every tenant (called by /api/cron). */
export async function runScheduledWorkflows(now = Date.now()) {
  const tenants = await systemDb().select({ id: organization.id }).from(organization);
  let runs = 0;
  for (const t of tenants) {
    await withTenant(t.id, async (tx) => {
      const list = await tx.select().from(workflows).where(eq(workflows.active, true));
      for (const wf of list) {
        const every = SCHEDULE_MS[normalizeTrigger(wf.trigger)];
        if (!every) continue;
        if (wf.lastRunAt && now - wf.lastRunAt.getTime() < every) continue;
        runs += (await runForCandidates(tx, wf)).length;
        await tx.update(workflows).set({ lastRunAt: new Date(now) }).where(eq(workflows.id, wf.id));
      }
    });
  }
  return { tenants: tenants.length, runs };
}
