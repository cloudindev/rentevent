"use server";
import { contacts, desc, ilike, items, or, orders, projects, withTenant } from "@rentevent/db";
import { getAppContext } from "../context";

export type SearchHit = { type: "pedido" | "proyecto" | "contacto" | "articulo"; id: string; title: string; subtitle: string; href: string };

export async function globalSearch(q: string): Promise<SearchHit[]> {
  const ctx = await getAppContext();
  if (!ctx || q.trim().length < 2) return [];
  const term = `%${q.trim().slice(0, 60)}%`;
  return withTenant(ctx.tenantId, async (tx) => {
    const [o, p, c, i] = await Promise.all([
      tx.select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status }).from(orders).where(or(ilike(orders.title, term), ilike(orders.number, term))).orderBy(desc(orders.periodStart)).limit(5),
      tx.select({ id: projects.id, number: projects.number, name: projects.name }).from(projects).where(or(ilike(projects.name, term), ilike(projects.number, term))).limit(5),
      tx.select({ id: contacts.id, name: contacts.name, kind: contacts.kind }).from(contacts).where(or(ilike(contacts.name, term), ilike(contacts.email, term), ilike(contacts.taxId, term))).limit(5),
      tx.select({ id: items.id, name: items.name, sku: items.sku }).from(items).where(or(ilike(items.name, term), ilike(items.sku, term))).limit(5),
    ]);
    return [
      ...o.map((x) => ({ type: "pedido" as const, id: x.id, title: `${x.number} · ${x.title}`, subtitle: x.status, href: `/app/pedidos/${x.id}` })),
      ...p.map((x) => ({ type: "proyecto" as const, id: x.id, title: x.name, subtitle: x.number, href: `/app/proyectos/${x.id}` })),
      ...c.map((x) => ({ type: "contacto" as const, id: x.id, title: x.name, subtitle: x.kind, href: `/app/contactos/${x.id}` })),
      ...i.map((x) => ({ type: "articulo" as const, id: x.id, title: x.name, subtitle: x.sku, href: `/app/inventario/${x.id}` })),
    ];
  });
}
