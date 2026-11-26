import "server-only";
import { z } from "zod";
import { addDays, dayKey, describeMaxLengths, maxLengthByFamily, parseDayKey, resizeConfiguration, zonedTime, type Anchoring } from "@rentevent/core";
import { and, asc, assignments, contacts, eq, gte, inArray, invoices, lt, ne, orders, shifts, withTenant, workerUnavailability, workers } from "@rentevent/db";
import { availableMap } from "@rentevent/db/services";
import { can, type Permission } from "@/lib/permissions";
import { formatEUR } from "@/lib/utils";
import type { AppContext } from "../context";
import { loadCatalog } from "../catalog";
import { bestMatch } from "./intent";

export type ToolResult = { text: string; data?: unknown; links?: { label: string; href: string }[] };

const dayRe = /^\d{4}-\d{2}-\d{2}$/;
const startOf = (k: string) => {
  const [y, m, d] = parseDayKey(k);
  return new Date(zonedTime(y, m, d, 0, 0));
};
const endOf = (k: string) => startOf(addDays(k, 1));
const fmtDay = (k: string) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(startOf(k).getTime() + 12 * 3600_000);
const fmtRange = (a: string, b: string) => (a === b ? fmtDay(a) : `del ${fmtDay(a)} al ${fmtDay(b)}`);

export const TOOL_SCHEMAS = {
  consultar_disponibilidad: z.object({ item: z.string().min(1).max(120), desde: z.string().regex(dayRe), hasta: z.string().regex(dayRe) }),
  largo_maximo: z.object({ desde: z.string().regex(dayRe), hasta: z.string().regex(dayRe), fijacion: z.enum(["anclaje", "pesos"]).default("anclaje") }),
  personal_libre: z.object({ fecha: z.string().regex(dayRe) }),
  pedidos_periodo: z.object({ desde: z.string().regex(dayRe), hasta: z.string().regex(dayRe) }),
  resumen_facturacion: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }),
  crear_borrador_pedido: z.object({
    titulo: z.string().min(2).max(120),
    cliente: z.string().max(120).nullable().optional(),
    familia: z.string().min(1).max(80),
    largo_m: z.number().positive().max(300),
    fecha_montaje: z.string().regex(dayRe),
    fecha_evento: z.string().regex(dayRe),
    fecha_retorno: z.string().regex(dayRe),
  }),
};
export type ToolName = keyof typeof TOOL_SCHEMAS;

/** JSON Schema definitions sent to the Messages API. */
export const TOOL_DEFINITIONS: { name: ToolName; description: string; input_schema: Record<string, unknown> }[] = [
  {
    name: "consultar_disponibilidad",
    description: "Unidades libres de un artículo del inventario (por nombre o SKU, por ejemplo 'cercha 10 m' o 'sillas') en un rango de fechas, y qué pedidos lo ocupan. Úsala para preguntas de stock concretas.",
    input_schema: { type: "object", properties: { item: { type: "string", description: "Nombre o SKU del artículo" }, desde: { type: "string", description: "Fecha inicial YYYY-MM-DD" }, hasta: { type: "string", description: "Fecha final YYYY-MM-DD (igual a desde para un día)" } }, required: ["item", "desde", "hasta"], additionalProperties: false },
  },
  {
    name: "largo_maximo",
    description: "Para un rango de fechas, el largo máximo de carpa montable por cada familia (ancho y pata) con el material libre. Úsala para '¿qué carpa puedo montar…?'.",
    input_schema: { type: "object", properties: { desde: { type: "string", description: "YYYY-MM-DD" }, hasta: { type: "string", description: "YYYY-MM-DD" }, fijacion: { type: "string", enum: ["anclaje", "pesos"], description: "Anclada al suelo o con pesos (por defecto anclaje)" } }, required: ["desde", "hasta"], additionalProperties: false },
  },
  {
    name: "personal_libre",
    description: "Trabajadores activos sin turnos asignados ni vacaciones o bajas en una fecha, con sus habilidades.",
    input_schema: { type: "object", properties: { fecha: { type: "string", description: "YYYY-MM-DD" } }, required: ["fecha"], additionalProperties: false },
  },
  {
    name: "pedidos_periodo",
    description: "Pedidos cuyo periodo (carga a retorno) se solapa con un rango de fechas, con estado y cliente.",
    input_schema: { type: "object", properties: { desde: { type: "string", description: "YYYY-MM-DD" }, hasta: { type: "string", description: "YYYY-MM-DD" } }, required: ["desde", "hasta"], additionalProperties: false },
  },
  {
    name: "resumen_facturacion",
    description: "Facturación emitida, cobrada y pendiente de un mes.",
    input_schema: { type: "object", properties: { mes: { type: "string", description: "YYYY-MM" } }, required: ["mes"], additionalProperties: false },
  },
  {
    name: "crear_borrador_pedido",
    description: "Crea un pedido en estado borrador con una carpa. No confirma ni reserva material. Devuelve el enlace al pedido. Úsala solo cuando el usuario pida crear un pedido o presupuesto.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        cliente: { type: "string", description: "Nombre del cliente existente (opcional)" },
        familia: { type: "string", description: "Familia de carpa: por ejemplo '10 m pata baja' o '15 alta'" },
        largo_m: { type: "number", description: "Largo en metros (múltiplo del módulo, normalmente 5)" },
        fecha_montaje: { type: "string", description: "YYYY-MM-DD de carga y montaje" },
        fecha_evento: { type: "string", description: "YYYY-MM-DD del evento" },
        fecha_retorno: { type: "string", description: "YYYY-MM-DD de retorno al almacén" },
      },
      required: ["titulo", "familia", "largo_m", "fecha_montaje", "fecha_evento", "fecha_retorno"],
      additionalProperties: false,
    },
  },
];

/** Extra permission a tool needs on top of access to the assistant. */
const TOOL_PERMISSIONS: Partial<Record<ToolName, { permission: Permission; denied: string }>> = {
  resumen_facturacion: { permission: "finanzas", denied: "No tienes permiso para consultar la facturación. Pídeselo a un administrador." },
  crear_borrador_pedido: { permission: "comercial", denied: "No tienes permiso para crear pedidos." },
};

/** Tool definitions this user may call (the model never sees the ones they can't use). */
export const toolDefinitionsFor = (role: string) => TOOL_DEFINITIONS.filter((t) => {
  const req = TOOL_PERMISSIONS[t.name];
  return !req || can(role, req.permission);
});

const STATUS: Record<string, string> = { borrador: "borrador", consulta: "consulta", opcion: "opción", confirmado: "confirmado", en_curso: "en curso", devuelto: "devuelto", cancelado: "cancelado" };

export async function runTool(ctx: AppContext, name: string, rawInput: unknown): Promise<ToolResult> {
  const schema = TOOL_SCHEMAS[name as ToolName];
  if (!schema) throw new Error(`Herramienta desconocida: ${name}`);
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) throw new Error(`Parámetros no válidos para ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  const input = parsed.data as never;
  const req = TOOL_PERMISSIONS[name as ToolName];
  if (req && !can(ctx.role, req.permission)) return { text: req.denied };
  switch (name as ToolName) {
    case "consultar_disponibilidad":
      return availability(ctx, input);
    case "largo_maximo":
      return maxLength(ctx, input);
    case "personal_libre":
      return freeCrew(ctx, input);
    case "pedidos_periodo":
      return ordersInPeriod(ctx, input);
    case "resumen_facturacion":
      return billing(ctx, input);
    case "crear_borrador_pedido":
      return createDraft(ctx, input);
  }
}

async function availability(ctx: AppContext, i: z.infer<typeof TOOL_SCHEMAS.consultar_disponibilidad>): Promise<ToolResult> {
  return withTenant(ctx.tenantId, async (tx) => {
    const cat = await loadCatalog(tx);
    const item = cat.items.find((x) => x.sku.toLowerCase() === i.item.toLowerCase()) ?? bestMatch(i.item, cat.items, (x) => `${x.name} ${x.sku}`);
    if (!item) return { text: `No encuentro ningún artículo que coincida con «${i.item}».` };
    const range = { start: startOf(i.desde), end: endOf(i.hasta) };
    const avail = (await availableMap(tx, [item.id], range)).get(item.id) ?? 0;
    const occupying = await tx
      .select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status })
      .from(orders)
      .where(and(lt(orders.periodStart, range.end), gte(orders.periodEnd, range.start), inArray(orders.status, ["confirmado", "opcion", "en_curso"])));
    const usable = item.stockTotal - item.stockRepair;
    return {
      text: `**${item.name}** ${fmtRange(i.desde, i.hasta)}: **${avail}** libres de ${usable} utilizables${item.stockRepair ? ` (${item.stockRepair} en reparación)` : ""}.`,
      data: { item: item.name, sku: item.sku, libres: avail, stock: item.stockTotal, reparacion: item.stockRepair, pedidosEnFechas: occupying.map((o) => `${o.number} ${o.title} (${STATUS[o.status]})`) },
      links: [{ label: item.name, href: `/app/inventario/${item.id}` }],
    };
  });
}

async function maxLength(ctx: AppContext, i: z.infer<typeof TOOL_SCHEMAS.largo_maximo>): Promise<ToolResult> {
  return withTenant(ctx.tenantId, async (tx) => {
    const cat = await loadCatalog(tx);
    const avail = await availableMap(tx, cat.items.map((x) => x.id), { start: startOf(i.desde), end: endOf(i.hasta) });
    const results = maxLengthByFamily(cat, avail, i.fijacion as Anchoring);
    const lines = results.map((r) => `- ${r.familyName}: ${r.maxModules > 0 ? `**${r.label}**` : "no disponible"}${r.limitingItemId && r.maxModules < (cat.families.find((f) => f.id === r.familyId)?.maxModules ?? 0) ? ` (limita: ${cat.items.find((x) => x.id === r.limitingItemId)?.name})` : ""}`);
    return {
      text: `${fmtRange(i.desde, i.hasta)}, ${i.fijacion === "pesos" ? "con pesos" : "anclada"}: ${describeMaxLengths(results)}\n\n${lines.join("\n")}`,
      data: results.map((r) => ({ familia: r.familyName, maximo: r.label, modulos: r.maxModules })),
      links: [{ label: "Ocupación de cerchas", href: "/app/carpas/ocupacion" }],
    };
  });
}

async function freeCrew(ctx: AppContext, i: z.infer<typeof TOOL_SCHEMAS.personal_libre>): Promise<ToolResult> {
  return withTenant(ctx.tenantId, async (tx) => {
    const a = startOf(i.fecha);
    const b = endOf(i.fecha);
    const [all, busy, away] = await Promise.all([
      tx.select().from(workers).where(eq(workers.active, true)).orderBy(asc(workers.name)),
      tx
        .select({ workerId: assignments.workerId, title: shifts.title })
        .from(assignments)
        .innerJoin(shifts, eq(shifts.id, assignments.shiftId))
        .where(and(lt(shifts.startsAt, b), gte(shifts.endsAt, a), ne(assignments.status, "rechazado"))),
      tx.select().from(workerUnavailability).where(and(lt(workerUnavailability.startsAt, b), gte(workerUnavailability.endsAt, a))),
    ]);
    const busyIds = new Set(busy.map((x) => x.workerId));
    const awayIds = new Set(away.map((x) => x.workerId));
    const free = all.filter((w) => !busyIds.has(w.id) && !awayIds.has(w.id));
    const today = dayKey(Date.now());
    const lines = free.map((w) => `- ${w.name}${w.skills.length ? ` · ${w.skills.map((s) => s.replace(/_/g, " ")).join(", ")}` : ""}${w.trainingExpiresAt && w.trainingExpiresAt < today ? " · ⚠ formación caducada" : ""}`);
    return {
      text: free.length
        ? `${fmtDay(i.fecha)} están libres **${free.length}** de ${all.length} trabajadores:\n\n${lines.join("\n")}${awayIds.size ? `\n\nNo disponibles por vacaciones o baja: ${all.filter((w) => awayIds.has(w.id)).map((w) => w.name).join(", ")}.` : ""}`
        : `${fmtDay(i.fecha)} no hay nadie libre: todos tienen turno o están de vacaciones o baja.`,
      data: { libres: free.map((w) => ({ nombre: w.name, habilidades: w.skills })), ocupados: busy.length, ausentes: awayIds.size },
      links: [{ label: "Tablero de turnos", href: "/app/personal/tablero" }],
    };
  });
}

async function ordersInPeriod(ctx: AppContext, i: z.infer<typeof TOOL_SCHEMAS.pedidos_periodo>): Promise<ToolResult> {
  return withTenant(ctx.tenantId, async (tx) => {
    const rows = await tx
      .select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status, start: orders.periodStart, end: orders.periodEnd, client: contacts.name })
      .from(orders)
      .leftJoin(contacts, eq(contacts.id, orders.clientId))
      .where(and(lt(orders.periodStart, endOf(i.hasta)), gte(orders.periodEnd, startOf(i.desde)), ne(orders.status, "cancelado")))
      .orderBy(asc(orders.periodStart));
    const f = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(d);
    return {
      text: rows.length
        ? `${rows.length} pedido${rows.length > 1 ? "s" : ""} ${fmtRange(i.desde, i.hasta)}:\n\n${rows.map((r) => `- [${r.number} · ${r.title}](/app/pedidos/${r.id}) · ${STATUS[r.status]} · ${f(r.start)}–${f(r.end)}${r.client ? ` · ${r.client}` : ""}`).join("\n")}`
        : `No hay pedidos ${fmtRange(i.desde, i.hasta)}.`,
      data: rows.map((r) => ({ numero: r.number, titulo: r.title, estado: r.status, carga: r.start, retorno: r.end, cliente: r.client, enlace: `/app/pedidos/${r.id}` })),
    };
  });
}

async function billing(ctx: AppContext, i: z.infer<typeof TOOL_SCHEMAS.resumen_facturacion>): Promise<ToolResult> {
  return withTenant(ctx.tenantId, async (tx) => {
    const [y, m] = i.mes.split("-").map(Number) as [number, number];
    const from = `${i.mes}-01`;
    const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const rows = await tx.select().from(invoices).where(and(gte(invoices.issueDate, from), lt(invoices.issueDate, to), inArray(invoices.status, ["emitida", "cobrada", "vencida"])));
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    const base = rows.reduce((s, r) => s + Number(r.subtotal), 0);
    const paid = rows.reduce((s, r) => s + Number(r.paid), 0);
    const overdue = rows.filter((r) => r.status === "vencida").reduce((s, r) => s + Number(r.total) - Number(r.paid), 0);
    const month = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15)));
    return {
      text: rows.length
        ? `En ${month} se emitieron **${rows.length} facturas** por **${formatEUR(total)}** (base ${formatEUR(base)}). Cobrado: ${formatEUR(paid)}. Pendiente: ${formatEUR(total - paid)}${overdue ? `, de lo que ${formatEUR(overdue)} está vencido` : ""}.`
        : `No hay facturas emitidas en ${month}.`,
      data: { mes: i.mes, facturas: rows.length, total, base, cobrado: paid, pendiente: total - paid, vencido: overdue },
      links: [{ label: "Ventas", href: "/app/ventas" }],
    };
  });
}

async function createDraft(ctx: AppContext, i: z.infer<typeof TOOL_SCHEMAS.crear_borrador_pedido>): Promise<ToolResult> {
  const { createOrder, saveOrderLines } = await import("../actions/orders");
  const prep = await withTenant(ctx.tenantId, async (tx) => {
    const cat = await loadCatalog(tx);
    const fams = cat.families.filter((f) => f.roofShape !== "jaima");
    const width = Number(i.familia.match(/\d+/)?.[0] ?? NaN);
    const alta = /alta/i.test(i.familia);
    const baja = /baja/i.test(i.familia);
    const family =
      fams.find((f) => f.width === width && (alta ? f.heightClass === "alta" : baja ? f.heightClass === "baja" : true)) ??
      bestMatch(i.familia, fams, (f) => `${f.name} ${f.code}`) ??
      null;
    const clients = await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.kind, "cliente"));
    const client = i.cliente ? bestMatch(i.cliente, clients, (c) => c.name) : null;
    return { family, client };
  });
  if (!prep.family) return { text: `No encuentro la familia de carpa «${i.familia}». Revisa las familias en Carpas.` };
  const fam = prep.family;
  const modules = Math.max(fam.minModules, Math.min(fam.maxModules, Math.round(i.largo_m / fam.moduleLength)));
  const [y1, m1, d1] = parseDayKey(i.fecha_montaje);
  const [y2, m2, d2] = parseDayKey(i.fecha_evento);
  const [y3, m3, d3] = parseDayKey(i.fecha_retorno);
  const loadAt = new Date(zonedTime(y1, m1, d1, 8, 0));
  const eventStart = new Date(Math.max(zonedTime(y2, m2, d2, 12, 0), loadAt.getTime() + 4 * 3600_000));
  const eventEnd = new Date(eventStart.getTime() + 10 * 3600_000);
  const returnAt = new Date(Math.max(zonedTime(y3, m3, d3, 18, 0), eventEnd.getTime() + 4 * 3600_000));
  const created = await createOrder({
    title: i.titulo,
    clientId: prep.client?.id ?? null,
    newClientName: !prep.client && i.cliente ? i.cliente : null,
    venueId: null,
    projectId: null,
    loadAt,
    eventStart,
    eventEnd,
    returnAt,
    templateId: null,
    familyId: fam.id,
  });
  if (!created.ok) return { text: `No he podido crear el pedido: ${created.error}` };
  const { loadWorkLines } = await import("../orders");
  const lines = await withTenant(ctx.tenantId, (tx) => loadWorkLines(tx, created.data.id));
  const resized = lines.map((l) => (l.kind === "carpa" ? { ...l, composition: { ...l.composition, tents: l.composition.tents.map((t) => ({ ...t, config: resizeConfiguration(t.config, modules) })) } } : l));
  const saved = await saveOrderLines({ orderId: created.data.id, lines: resized });
  const size = `${fam.width}x${modules * fam.moduleLength}`;
  return {
    text: `He creado el borrador **${i.titulo}** con una ${fam.name} de **${size}**${prep.client ? ` para ${prep.client.name}` : i.cliente ? ` para ${i.cliente} (cliente nuevo)` : ""}. Carga ${fmtDay(i.fecha_montaje)}, retorno ${fmtDay(i.fecha_retorno)}.${saved.ok ? "" : ` Aviso: ${saved.error}`} Revisa la disponibilidad en el pedido antes de enviarlo.`,
    data: { pedidoId: created.data.id, medida: size, enlace: `/app/pedidos/${created.data.id}` },
    links: [{ label: `Abrir pedido ${size}`, href: `/app/pedidos/${created.data.id}` }],
  };
}
