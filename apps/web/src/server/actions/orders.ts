"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  contacts,
  desc,
  eq,
  inArray,
  items,
  orders,
  projectPhases,
  projects,
  quotes,
  subrentals,
  tentTemplates,
  venues,
  type Tx,
} from "@rentevent/db";
import { AvailabilityConflictError, availableMap, checkOrderAvailability, reserveOrder, syncReservations } from "@rentevent/db/services";
import { addDays, compositionSchema, dayKey, defaultConfiguration, quoteTotals, shortagesFor } from "@rentevent/core";
import { materialOf, orderTotals, tentLabel, type WorkLine } from "@/lib/order-model";
import { audit } from "../audit";
import { tenantAction, UserError } from "../action";
import { nextCounter } from "../numbering";
import { loadCatalogue, tenantPricing } from "../orders";
import { persistLines } from "../order-persist";
import { emitEvent } from "../events";
import { buildTimeline } from "../timeline";
import { putObject } from "@/lib/adapters/storage";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/adapters/email";
import { env } from "@/lib/env";


const priceMode = z.enum(["unidad", "dia", "periodo", "m2", "ml", "incluido", "hora", "km"]);
const workLine = z.discriminatedUnion("kind", [
  z.object({ key: z.string(), kind: z.literal("carpa"), tentConfigId: z.string().uuid().nullable(), label: z.string().max(120), composition: compositionSchema, unitPrice: z.number().min(0).nullable(), discountPct: z.number().min(0).max(100) }),
  z.object({ key: z.string(), kind: z.literal("articulo"), itemId: z.string().uuid(), description: z.string().max(200), quantity: z.number().min(0).max(1e6), unitPrice: z.number().min(0), priceMode, discountPct: z.number().min(0).max(100) }),
  z.object({ key: z.string(), kind: z.literal("kit"), kitId: z.string().uuid(), description: z.string().max(200), quantity: z.number().min(0).max(1e5), unitPrice: z.number().min(0), discountPct: z.number().min(0).max(100) }),
  z.object({ key: z.string(), kind: z.enum(["servicio", "transporte", "mano_obra", "texto"]), description: z.string().max(500), quantity: z.number().min(0).max(1e6), unitPrice: z.number().min(-1e7).max(1e7), priceMode, discountPct: z.number().min(0).max(100), unitCost: z.number().min(0) }),
]);

function phaseTimes(load: Date, eventStart: Date, eventEnd: Date, ret: Date) {
  const H = 3_600_000;
  const t = (d: Date, h: number) => new Date(d.getTime() + h * H);
  const montajeEnd = new Date(Math.max(t(load, 6).getTime(), eventStart.getTime() - 2 * H));
  return [
    ["carga", load, t(load, 2)],
    ["transporte", t(load, 2), t(load, 4)],
    ["montaje", t(load, 4), montajeEnd > t(load, 4) ? montajeEnd : t(load, 10)],
    ["evento", eventStart, eventEnd],
    ["desmontaje", t(eventEnd, 2), new Date(Math.max(t(eventEnd, 6).getTime(), ret.getTime() - 3 * H))],
    ["retorno", new Date(ret.getTime() - 3 * H), ret],
  ] as const;
}

async function syncProjectStatus(tx: Tx, projectId: string) {
  const os = await tx.select({ status: orders.status, start: orders.periodStart, end: orders.periodEnd }).from(orders).where(eq(orders.projectId, projectId));
  const rank = ["cancelado", "borrador", "consulta", "devuelto", "opcion", "confirmado", "en_curso"];
  const top = os.map((o) => o.status).sort((a, b) => rank.indexOf(b) - rank.indexOf(a))[0] ?? "consulta";
  const status = top === "borrador" ? "consulta" : top;
  const start = os.length ? new Date(Math.min(...os.map((o) => o.start.getTime()))) : null;
  const end = os.length ? new Date(Math.max(...os.map((o) => o.end.getTime()))) : null;
  await tx.update(projects).set({ status, startsAt: start, endsAt: end }).where(eq(projects.id, projectId));
}

const createInput = z
  .object({
    title: z.string().trim().min(2, "Indica un título").max(120),
    clientId: z.string().uuid().nullable(),
    newClientName: z.string().trim().max(120).nullable(),
    venueId: z.string().uuid().nullable(),
    projectId: z.string().uuid().nullable(),
    loadAt: z.coerce.date(),
    eventStart: z.coerce.date(),
    eventEnd: z.coerce.date(),
    returnAt: z.coerce.date(),
    templateId: z.string().uuid().nullable(),
    familyId: z.string().uuid().nullable(),
  })
  .refine((d) => d.loadAt <= d.eventStart && d.eventStart < d.eventEnd && d.eventEnd <= d.returnAt, { message: "Las fechas deben ir en orden: carga, evento y retorno", path: ["returnAt"] });

export const createOrder = tenantAction(createInput, "comercial", async (input, tx, ctx) => {
  let clientId = input.clientId;
  if (!clientId && input.newClientName) {
    const [c] = await tx.insert(contacts).values({ kind: "cliente", name: input.newClientName }).returning({ id: contacts.id });
    clientId = c!.id;
  }
  let projectId = input.projectId;
  if (!projectId) {
    const n = await nextCounter(tx, "proyecto");
    const [v] = input.venueId ? await tx.select().from(venues).where(eq(venues.id, input.venueId)) : [undefined];
    const [p] = await tx
      .insert(projects)
      .values({ number: `P-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`, name: input.title, clientId, venueId: input.venueId, lat: v?.lat ?? null, lng: v?.lng ?? null, locationAddress: v?.address ?? null, status: "consulta", startsAt: input.loadAt, endsAt: input.returnAt, managerId: ctx.user.id })
      .returning({ id: projects.id });
    projectId = p!.id;
    for (const [kind, a, b] of phaseTimes(input.loadAt, input.eventStart, input.eventEnd, input.returnAt)) await tx.insert(projectPhases).values({ projectId, kind, startsAt: a, endsAt: b });
  }
  const number = String(await nextCounter(tx, "pedido"));
  const [client] = clientId ? await tx.select().from(contacts).where(eq(contacts.id, clientId)) : [undefined];
  const [o] = await tx
    .insert(orders)
    .values({ projectId, number, title: input.title, status: "borrador", clientId, periodStart: input.loadAt, periodEnd: input.returnAt, eventStart: input.eventStart, eventEnd: input.eventEnd, discountPct: Number(client?.discountPct ?? 0) })
    .returning({ id: orders.id });
  let composition = null;
  if (input.templateId) {
    const [t] = await tx.select().from(tentTemplates).where(eq(tentTemplates.id, input.templateId));
    if (t) {
      composition = compositionSchema.parse(t.composition);
      await tx.update(tentTemplates).set({ usageCount: t.usageCount + 1 }).where(eq(tentTemplates.id, t.id));
    }
  } else if (input.familyId) {
    const cat = await loadCatalogue(tx);
    const fam = cat.families.find((f) => f.id === input.familyId);
    if (fam) composition = { version: 1 as const, tents: [{ id: "t1", label: "", config: defaultConfiguration(fam, 4), placement: { x: 0, y: 0, rotation: 0 } }], gutters: [], site: null };
  }
  if (composition) await persistLines(tx, o!.id, [{ key: "new", kind: "carpa", tentConfigId: null, label: "", composition, unitPrice: null, discountPct: 0 }]);
  await audit(tx, ctx, "order", o!.id, "crear", { numero: number });
  await syncProjectStatus(tx, projectId);
  emitEvent(ctx.tenantId, "order.created", { id: o!.id, number, title: input.title });
  revalidatePath("/app/pedidos");
  return { id: o!.id };
});

export const saveOrderLines = tenantAction(z.object({ orderId: z.string().uuid(), lines: z.array(workLine).max(300) }), "comercial", async ({ orderId, lines }, tx, ctx) => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) throw new UserError("Pedido no encontrado");
  if (["devuelto", "cancelado"].includes(o.status)) throw new UserError("El pedido está cerrado: reábrelo para editarlo.");
  const configIds = await persistLines(tx, orderId, lines as WorkLine[]);
  // a confirmed order must still fit: re-check under lock
  if (o.status === "confirmado" || o.status === "en_curso") {
    const checks = await checkOrderAvailability(tx, orderId);
    const short = checks.filter((c) => c.shortage > 0);
    if (short.length) {
      const names = await tx.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, short.map((s) => s.itemId)));
      throw new UserError(`No hay material para este cambio en un pedido confirmado: ${short.map((s) => `faltan ${s.shortage} ${names.find((n) => n.id === s.itemId)?.name ?? ""}`).join(", ")}. Pásalo a opción o crea un subalquiler.`);
    }
  }
  await tx.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, orderId));
  await audit(tx, ctx, "order", orderId, "editar", { lineas: lines.length });
  revalidatePath(`/app/pedidos/${orderId}`);
  const [fresh] = await tx.select({ updatedAt: orders.updatedAt }).from(orders).where(eq(orders.id, orderId));
  return { savedAt: fresh!.updatedAt.toISOString(), configIds };
});

const headerInput = z
  .object({
    orderId: z.string().uuid(),
    title: z.string().trim().min(2).max(120),
    clientId: z.string().uuid().nullable(),
    venueId: z.string().uuid().nullable(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    eventStart: z.coerce.date(),
    eventEnd: z.coerce.date(),
    discountPct: z.coerce.number().min(0).max(100),
    holiday: z.boolean(),
    trips: z.coerce.number().int().min(1).max(50),
    notes: z.string().max(4000).nullable(),
    distanceKm: z.coerce.number().min(0).max(5000).nullable(),
  })
  .refine((d) => d.periodStart <= d.eventStart && d.eventStart < d.eventEnd && d.eventEnd <= d.periodEnd, { message: "Las fechas deben ir en orden: carga, evento y retorno", path: ["periodEnd"] });

export const updateOrderHeader = tenantAction(headerInput, "comercial", async (input, tx, ctx) => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update");
  if (!o) throw new UserError("Pedido no encontrado");
  await tx
    .update(orders)
    .set({ title: input.title, clientId: input.clientId, periodStart: input.periodStart, periodEnd: input.periodEnd, eventStart: input.eventStart, eventEnd: input.eventEnd, discountPct: input.discountPct, holiday: input.holiday, trips: input.trips, notes: input.notes })
    .where(eq(orders.id, input.orderId));
  const v = input.venueId ? (await tx.select().from(venues).where(eq(venues.id, input.venueId)))[0] : undefined;
  await tx.update(projects).set({ venueId: input.venueId, clientId: input.clientId ?? undefined, distanceKm: input.distanceKm, lat: v?.lat ?? undefined, lng: v?.lng ?? undefined, locationAddress: v?.address ?? undefined }).where(eq(projects.id, o.projectId));
  const datesChanged = o.periodStart.getTime() !== input.periodStart.getTime() || o.periodEnd.getTime() !== input.periodEnd.getTime();
  if (datesChanged) {
    await tx.delete(projectPhases).where(eq(projectPhases.projectId, o.projectId));
    for (const [kind, a, b] of phaseTimes(input.periodStart, input.eventStart, input.eventEnd, input.periodEnd)) await tx.insert(projectPhases).values({ projectId: o.projectId, kind, startsAt: a, endsAt: b });
    if (o.status === "confirmado" || o.status === "en_curso") {
      try {
        await reserveOrder(tx, input.orderId, "confirmado", { userId: ctx.user.id });
      } catch (e) {
        if (e instanceof AvailabilityConflictError) throw new UserError("Con las nuevas fechas no hay material suficiente para un pedido confirmado. Pásalo a opción o ajusta las cantidades.");
        throw e;
      }
    } else await syncReservations(tx, input.orderId);
  }
  await syncProjectStatus(tx, o.projectId);
  await audit(tx, ctx, "order", input.orderId, "editar", { cabecera: true, fechas: datesChanged });
  revalidatePath(`/app/pedidos/${input.orderId}`);
  return { ok: true };
});

export type ShortageView = { itemId: string; name: string; requested: number; available: number; shortage: number; occupants: { projectName: string; quantity: number; status: string }[] };

export const changeOrderStatus = tenantAction(
  z.object({ orderId: z.string().uuid(), status: z.enum(["borrador", "consulta", "opcion", "confirmado", "en_curso", "devuelto", "cancelado"]), optionDays: z.number().int().min(1).max(90).optional() }),
  "comercial",
  async ({ orderId, status, optionDays }, tx, ctx): Promise<{ status: string; shortages: ShortageView[] }> => {
    if (status === "confirmado" && !["administrador", "comercial"].includes(ctx.role)) throw new UserError("No tienes permiso para confirmar pedidos.");
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!o) throw new UserError("Pedido no encontrado");
    if (status === "confirmado" || status === "opcion" || status === "consulta") {
      const pricing = await tenantPricing(tx);
      try {
        const expires = status === "opcion" ? new Date(Date.now() + (optionDays ?? pricing.optionDays) * 86_400_000) : null;
        await reserveOrder(tx, orderId, status, { userId: ctx.user.id, optionExpiresAt: expires });
      } catch (e) {
        if (!(e instanceof AvailabilityConflictError)) throw e;
        const names = await tx.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, e.shortages.map((s) => s.itemId)));
        return {
          status: o.status,
          shortages: e.shortages.map((s) => ({ itemId: s.itemId, name: names.find((n) => n.id === s.itemId)?.name ?? s.itemId, requested: s.requested, available: s.available, shortage: s.shortage, occupants: s.occupants.map((x) => ({ projectName: x.projectName, quantity: x.quantity, status: x.status })) })),
        };
      }
    } else {
      await tx.update(orders).set({ status, optionExpiresAt: null }).where(eq(orders.id, orderId));
      await syncReservations(tx, orderId);
    }
    await syncProjectStatus(tx, o.projectId);
    await audit(tx, ctx, "order", orderId, status === "confirmado" ? "confirmar" : status === "cancelado" ? "cancelar" : "estado", { de: o.status, a: status });
    emitEvent(ctx.tenantId, status === "confirmado" ? "order.confirmed" : status === "cancelado" ? "order.cancelled" : "order.updated", { id: orderId, number: o.number, title: o.title, from: o.status, status });
    revalidatePath(`/app/pedidos/${orderId}`);
    revalidatePath("/app/pedidos");
    return { status, shortages: [] };
  },
);

export const getItemTimeline = tenantAction(
  z.object({ orderId: z.string().uuid(), itemId: z.string().uuid(), quantity: z.number().min(0) }),
  "ver",
  async ({ orderId, itemId, quantity }, tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!o) throw new UserError("Pedido no encontrado");
    const from = addDays(dayKey(o.periodStart.getTime()), -1);
    let to = addDays(dayKey(o.periodEnd.getTime()), 1);
    if (to < addDays(from, 6)) to = addDays(from, 6);
    return buildTimeline(tx, itemId, from, to > addDays(from, 20) ? addDays(from, 20) : to, { orderId, loadAt: o.periodStart, returnAt: o.periodEnd, quantity });
  },
);

export const createSubrentalForShortage = tenantAction(
  z.object({ orderId: z.string().uuid(), itemId: z.string().uuid(), quantity: z.number().positive(), supplierId: z.string().uuid().nullable(), cost: z.number().min(0) }),
  "comercial",
  async (input, tx, ctx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
    if (!o) throw new UserError("Pedido no encontrado");
    const [row] = await tx
      .insert(subrentals)
      .values({ supplierId: input.supplierId, itemId: input.itemId, projectId: o.projectId, orderId: o.id, quantity: input.quantity, startsAt: o.periodStart, endsAt: o.periodEnd, cost: input.cost, status: "solicitado", notes: `Para cubrir la escasez del pedido ${o.number}` })
      .returning({ id: subrentals.id });
    await audit(tx, ctx, "subrental", row!.id, "crear", { pedido: o.number });
    revalidatePath("/app/subalquileres");
    return { id: row!.id };
  },
);

/** Availability of the order's material shifted ±N days (alternative dates). */
export const dateAlternatives = tenantAction(z.object({ orderId: z.string().uuid(), lines: z.array(workLine).max(300) }), "ver", async ({ orderId, lines }, tx) => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw new UserError("Pedido no encontrado");
  const cat = await loadCatalogue(tx);
  const { requirements } = materialOf(lines as WorkLine[], cat);
  const ids = requirements.map((r) => r.itemId);
  const out: { offsetDays: number; ok: boolean; missing: number }[] = [];
  for (const off of [-3, -2, -1, 1, 2, 3, 7]) {
    const sh = off * 86_400_000;
    const avail = await availableMap(tx, ids, { start: new Date(o.periodStart.getTime() + sh), end: new Date(o.periodEnd.getTime() + sh) }, orderId);
    const short = shortagesFor(requirements, avail);
    out.push({ offsetDays: off, ok: short.length === 0, missing: short.reduce((s, x) => s + x.missing, 0) });
  }
  return out;
});

export const duplicateOrder = tenantAction(z.object({ orderId: z.string().uuid() }), "comercial", async ({ orderId }, tx, ctx) => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw new UserError("Pedido no encontrado");
  const number = String(await nextCounter(tx, "pedido"));
  const [copy] = await tx
    .insert(orders)
    .values({ projectId: o.projectId, number, title: `${o.title} (copia)`, status: "borrador", clientId: o.clientId, periodStart: o.periodStart, periodEnd: o.periodEnd, eventStart: o.eventStart, eventEnd: o.eventEnd, discountPct: o.discountPct, holiday: o.holiday, trips: o.trips, notes: o.notes })
    .returning({ id: orders.id });
  const { loadWorkLines } = await import("../orders");
  const lines = (await loadWorkLines(tx, orderId)).map((l) => (l.kind === "carpa" ? { ...l, tentConfigId: null } : l));
  await persistLines(tx, copy!.id, lines);
  await audit(tx, ctx, "order", copy!.id, "crear", { copiaDe: o.number });
  return { id: copy!.id };
});

/** Creates a new quote version: a frozen snapshot of lines, totals, 3D image and terms. */
export const createQuote = tenantAction(
  z.object({ orderId: z.string().uuid(), imagePng: z.string().max(8_000_000).nullable() }),
  "comercial",
  async ({ orderId, imagePng }, tx, ctx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!o) throw new UserError("Pedido no encontrado");
    const { loadWorkLines } = await import("../orders");
    const lines = await loadWorkLines(tx, orderId);
    if (lines.length === 0) throw new UserError("El pedido no tiene líneas.");
    const cat = await loadCatalogue(tx);
    const pricing = await tenantPricing(tx);
    const days = o.eventStart && o.eventEnd ? Math.max(1, Math.ceil((o.eventEnd.getTime() - o.eventStart.getTime()) / 86_400_000)) : 1;
    const t = orderTotals(lines, cat, { days, holiday: o.holiday, settings: pricing.pricing, globalDiscountPct: Number(o.discountPct) });
    const [last] = await tx.select({ v: quotes.version }).from(quotes).where(eq(quotes.orderId, orderId)).orderBy(desc(quotes.version)).limit(1);
    const version = (last?.v ?? 0) + 1;
    let imageKey: string | null = null;
    if (imagePng?.startsWith("data:image/png;base64,")) {
      imageKey = `${ctx.tenantId}/presupuestos/${orderId}/v${version}.png`;
      await putObject(imageKey, Buffer.from(imagePng.split(",")[1]!, "base64"), "image/png");
    }
    const tents = lines.filter((l) => l.kind === "carpa").map((l) => ({ label: tentLabel(l as never, cat), composition: (l as { composition: unknown }).composition, bom: t.boms.get(l.key)?.lines.map((b) => ({ name: cat.items.find((i) => i.id === b.itemId)?.name ?? "", quantity: b.quantity, unit: cat.items.find((i) => i.id === b.itemId)?.unit ?? "ud" })), metrics: t.boms.get(l.key)?.totals }));
    const totals = quoteTotals(t.rows, { days, holiday: o.holiday, settings: pricing.pricing, globalDiscountPct: Number(o.discountPct) });
    const validUntil = new Date(Date.now() + pricing.validity * 86_400_000).toISOString().slice(0, 10);
    const [q] = await tx
      .insert(quotes)
      .values({
        orderId,
        version,
        number: `${o.number}-${version}`,
        status: "borrador",
        snapshot: { rows: t.rows.map((r) => ({ description: r.description, quantity: r.quantity, unitPrice: r.unitPrice, priceMode: r.priceMode, discountPct: r.discountPct, kind: r.kind, taxRate: r.taxRate ?? pricing.pricing.vatRate })), totals, tents, terms: pricing.terms, days, imageKey, title: o.title, eventStart: o.eventStart, eventEnd: o.eventEnd, periodStart: o.periodStart, periodEnd: o.periodEnd },
        total: totals.total,
        validUntil,
        publicToken: randomBytes(18).toString("base64url"),
      })
      .returning({ id: quotes.id, version: quotes.version });
    if (o.status === "borrador") {
      await tx.update(orders).set({ status: "consulta" }).where(eq(orders.id, orderId));
      await syncReservations(tx, orderId);
    }
    await audit(tx, ctx, "quote", q!.id, "crear", { version });
    revalidatePath(`/app/pedidos/${orderId}`);
    return q!;
  },
);

export const sendQuote = tenantAction(
  z.object({ quoteId: z.string().uuid(), to: z.string().email("Correo no válido"), message: z.string().max(4000) }),
  "comercial",
  async ({ quoteId, to, message }, tx, ctx) => {
    const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!q) throw new UserError("Presupuesto no encontrado");
    const [o] = await tx.select().from(orders).where(eq(orders.id, q.orderId));
    const url = `${env.appUrl}/p/presupuesto/${q.publicToken}`;
    await sendEmail({
      to,
      subject: `Presupuesto ${q.number} · ${o?.title ?? ""}`,
      html: emailLayout({ title: `Presupuesto ${q.number}`, body: `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`, cta: { label: "Ver presupuesto y carpa en 3D", url }, footer: `${ctx.tenantName} · enviado con Rentevent` }),
      text: `${message}\n\n${url}`,
    });
    await tx.update(quotes).set({ status: "enviado", sentAt: new Date() }).where(eq(quotes.id, quoteId));
    const { emails } = await import("@rentevent/db");
    await tx.insert(emails).values({ direction: "saliente", fromAddress: ctx.user.email, toAddress: to, subject: `Presupuesto ${q.number}`, body: `${message}\n\n${url}`, entity: "order", entityId: q.orderId, read: true });
    await audit(tx, ctx, "quote", quoteId, "enviar", { to });
    emitEvent(ctx.tenantId, "quote.sent", { id: quoteId, number: q.number, orderId: q.orderId });
    revalidatePath(`/app/pedidos/${q.orderId}`);
    return { url };
  },
);

export const saveAsTemplate = tenantAction(z.object({ name: z.string().trim().min(2).max(80), composition: compositionSchema }), "comercial", async (input, tx, ctx) => {
  const [row] = await tx.insert(tentTemplates).values({ name: input.name, composition: input.composition, description: `Guardada por ${ctx.user.name}` }).returning({ id: tentTemplates.id });
  return { id: row!.id };
});

