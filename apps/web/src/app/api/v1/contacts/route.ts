import { z } from "zod";
import { asc, contacts, gt } from "@rentevent/db";
import { ApiError, page, pageParams, readJson, withApiKey } from "@/server/api/http";
import { dispatchWebhook } from "@/server/api/webhooks";

/** GET /api/v1/contacts */
export async function GET(req: Request) {
  const { limit, cursor } = pageParams(req);
  return withApiKey(req, async (tx) => {
    const rows = await tx
      .select({ id: contacts.id, kind: contacts.kind, name: contacts.name, tax_id: contacts.taxId, email: contacts.email, phone: contacts.phone, discount_pct: contacts.discountPct, created_at: contacts.createdAt })
      .from(contacts)
      .where(cursor ? gt(contacts.id, cursor) : undefined)
      .orderBy(asc(contacts.id))
      .limit(limit + 1);
    return page(rows, limit);
  });
}

const body = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["cliente", "proveedor", "localizacion"]).default("cliente"),
  tax_id: z.string().trim().max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
});

/** POST /api/v1/contacts */
export async function POST(req: Request) {
  return withApiKey(req, async (tx) => {
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(422, "validation_error", "Datos no válidos", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    const d = parsed.data;
    const [row] = await tx.insert(contacts).values({ name: d.name, kind: d.kind, taxId: d.tax_id ?? null, email: d.email ?? null, phone: d.phone ?? null }).returning();
    await dispatchWebhook(tx, "contact.created", { id: row!.id, name: row!.name });
    return new Response(JSON.stringify({ id: row!.id, name: row!.name, kind: row!.kind }), { status: 201, headers: { "Content-Type": "application/json" } });
  });
}
