import { z } from "zod";
import { and, contacts, emails, eq, ilike, organization, orders, systemDb, tenantSettings, withTenant } from "@rentevent/db";
import { env } from "@/lib/env";

const schema = z.object({ from: z.string().min(3).max(320), to: z.string().min(3).max(320), subject: z.string().max(500).default(""), text: z.string().max(100_000).default("") });

const addr = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();

/**
 * Inbound email webhook (any provider that can POST JSON). Header
 * `x-webhook-secret` must equal EMAIL_WEBHOOK_SECRET (or CRON_SECRET).
 * The company is resolved from the recipient (its configured email, or
 * `<subdominio>@…`). Auto-links to an order whose number appears in the
 * subject, otherwise to the contact with the sender's email.
 */
export async function POST(req: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET || env.cronSecret;
  if (req.headers.get("x-webhook-secret") !== secret) return Response.json({ error: "No autorizado" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  const { from, to, subject, text } = parsed.data;
  const toAddr = addr(to);
  const [bySettings] = await systemDb().select({ id: tenantSettings.tenantId }).from(tenantSettings).where(eq(tenantSettings.email, toAddr));
  const [bySlug] = bySettings ? [] : await systemDb().select({ id: organization.id }).from(organization).where(eq(organization.slug, toAddr.split("@")[0] ?? ""));
  const tenantId = bySettings?.id ?? bySlug?.id;
  if (!tenantId) return Response.json({ error: "Destinatario desconocido" }, { status: 404 });
  const row = await withTenant(tenantId, async (tx) => {
    let entity: string | null = null;
    let entityId: string | null = null;
    const num = subject.match(/\b(\d{5,8})\b/)?.[1];
    if (num) {
      const [o] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.number, num));
      if (o) {
        entity = "order";
        entityId = o.id;
      }
    }
    if (!entity) {
      const [c] = await tx.select({ id: contacts.id }).from(contacts).where(and(ilike(contacts.email, addr(from))));
      if (c) {
        entity = "contact";
        entityId = c.id;
      }
    }
    const [r] = await tx.insert(emails).values({ direction: "entrante", fromAddress: addr(from), toAddress: toAddr, subject: subject || "(sin asunto)", body: text, entity, entityId, read: false, status: "recibido" }).returning({ id: emails.id });
    return { id: r!.id, entity, entityId };
  });
  return Response.json({ ok: true, ...row }, { status: 201 });
}
