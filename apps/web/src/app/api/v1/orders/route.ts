import { z } from "zod";
import { and, asc, eq, gt, orders, projectPhases, projects } from "@rentevent/db";
import { ApiError, page, pageParams, readJson, withApiKey } from "@/server/api/http";
import { dispatchWebhook } from "@/server/api/webhooks";
import { nextCounter } from "@/server/numbering";

/** GET /api/v1/orders?status=confirmado */
export async function GET(req: Request) {
  const { limit, cursor, url } = pageParams(req);
  const status = url.searchParams.get("status");
  return withApiKey(req, async (tx) => {
    const rows = await tx
      .select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status, client_id: orders.clientId, project_id: orders.projectId, period_start: orders.periodStart, period_end: orders.periodEnd, event_start: orders.eventStart, event_end: orders.eventEnd })
      .from(orders)
      .where(and(cursor ? gt(orders.id, cursor) : undefined, status ? eq(orders.status, status) : undefined))
      .orderBy(asc(orders.id))
      .limit(limit + 1);
    return page(rows, limit);
  });
}

const body = z
  .object({
    title: z.string().trim().min(2).max(120),
    client_id: z.string().uuid().optional(),
    load_at: z.coerce.date(),
    event_start: z.coerce.date(),
    event_end: z.coerce.date(),
    return_at: z.coerce.date(),
    notes: z.string().max(4000).optional(),
  })
  .refine((d) => d.load_at <= d.event_start && d.event_start < d.event_end && d.event_end <= d.return_at, { message: "Orden de fechas: load_at ≤ event_start < event_end ≤ return_at" });

/** POST /api/v1/orders — creates a draft order (and its project). */
export async function POST(req: Request) {
  return withApiKey(req, async (tx) => {
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(422, "validation_error", "Datos no válidos", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const d = parsed.data;
    const pn = await nextCounter(tx, "proyecto");
    const [p] = await tx
      .insert(projects)
      .values({ number: `P-${d.load_at.getUTCFullYear()}-${String(pn).padStart(3, "0")}`, name: d.title, clientId: d.client_id ?? null, status: "consulta", startsAt: d.load_at, endsAt: d.return_at })
      .returning({ id: projects.id });
    await tx.insert(projectPhases).values({ projectId: p!.id, kind: "evento", startsAt: d.event_start, endsAt: d.event_end });
    const number = String(await nextCounter(tx, "pedido"));
    const [o] = await tx
      .insert(orders)
      .values({ projectId: p!.id, number, title: d.title, status: "borrador", clientId: d.client_id ?? null, periodStart: d.load_at, periodEnd: d.return_at, eventStart: d.event_start, eventEnd: d.event_end, notes: d.notes ?? "Creado por API" })
      .returning();
    await dispatchWebhook(tx, "order.created", { id: o!.id, number, title: d.title });
    const [created] = await tx.select({ id: orders.id, number: orders.number, status: orders.status }).from(orders).where(eq(orders.id, o!.id));
    return new Response(JSON.stringify(created), { status: 201, headers: { "Content-Type": "application/json" } });
  });
}
