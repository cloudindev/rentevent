import { and, contactAddresses, contactPersons, contacts, emails, eq, invoices, notes, orders, or, withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";

/** RGPD access request for a single contact: everything stored about them. */
export async function GET(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "configuracion")) return new Response("No autorizado", { status: 403 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Identificador no válido", { status: 400 });
  const data = await withTenant(ctx.tenantId, async (tx) => {
    const [c] = await tx.select().from(contacts).where(eq(contacts.id, id));
    if (!c) return null;
    const res = {
      contacto: c,
      direcciones: await tx.select().from(contactAddresses).where(eq(contactAddresses.contactId, id)),
      personas: await tx.select().from(contactPersons).where(eq(contactPersons.contactId, id)),
      pedidos: await tx.select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status, periodStart: orders.periodStart }).from(orders).where(eq(orders.clientId, id)),
      facturas: await tx.select({ id: invoices.id, fullNumber: invoices.fullNumber, issueDate: invoices.issueDate, total: invoices.total }).from(invoices).where(eq(invoices.clientId, id)),
      correos: await tx.select().from(emails).where(or(and(eq(emails.entity, "contact"), eq(emails.entityId, id)), c.email ? or(eq(emails.toAddress, c.email), eq(emails.fromAddress, c.email)) : undefined)),
      notas: await tx.select().from(notes).where(and(eq(notes.entity, "contact"), eq(notes.entityId, id))),
    };
    await audit(tx, ctx, "contact", id, "exportar", { rgpd: true });
    return res;
  });
  if (!data) return new Response("No encontrado", { status: 404 });
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="contacto-${id.slice(0, 8)}.json"` } });
}
