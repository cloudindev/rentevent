import "server-only";
import { contactAddresses, contacts, eq, ilike, items, orders, projects, projectPhases, type Tx } from "@rentevent/db";
import type { AppContext } from "../context";
import { audit } from "../audit";
import { nextCounter } from "../numbering";
import { skuFromName, type ImportEntity, type MappedRow } from "./mapping";

export type ImportResult = { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] };

const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const n = (v: unknown) => (typeof v === "number" ? v : null);

/** Imports validated rows in the caller's transaction. Rows with errors are skipped. */
export async function runImport(tx: Tx, ctx: Pick<AppContext, "user">, entity: ImportEntity, rows: MappedRow[], opts: { dryRun?: boolean } = {}): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const r of rows) {
    if (r.errors.length) {
      result.skipped++;
      result.errors.push({ row: r.index + 2, message: r.errors.join("; ") });
      continue;
    }
    const v = r.values;
    if (entity === "inventario") {
      const sku = s(v.sku) ?? skuFromName(String(v.name), r.index);
      const [existing] = await tx.select({ id: items.id }).from(items).where(eq(items.sku, sku));
      const values = {
        sku,
        name: String(v.name),
        category: s(v.category) ?? "General",
        stockTotal: n(v.stockTotal) ?? 0,
        weightKg: n(v.weightKg) ?? 0,
        volumeM3: n(v.volumeM3) ?? 0,
        price: n(v.price) ?? 0,
        costPrice: n(v.costPrice) ?? 0,
        unit: (s(v.unit) ?? "ud") as string,
        location: s(v.location),
      };
      if (opts.dryRun) {
        if (existing) result.updated++;
        else result.created++;
      } else if (existing) {
        const { sku: _sku, ...upd } = values;
        await tx.update(items).set({ ...upd, ...(v.weightKg == null ? { weightKg: undefined } : {}), ...(v.price == null ? { price: undefined } : {}), ...(v.stockTotal == null ? { stockTotal: undefined } : {}) }).where(eq(items.id, existing.id));
        result.updated++;
      } else {
        await tx.insert(items).values(values);
        result.created++;
      }
    } else if (entity === "contactos") {
      const taxId = s(v.taxId)?.toUpperCase().replace(/[\s-]/g, "") ?? null;
      const [existing] = taxId
        ? await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.taxId, taxId))
        : await tx.select({ id: contacts.id }).from(contacts).where(ilike(contacts.name, String(v.name)));
      const values = { name: String(v.name), kind: (s(v.kind) ?? "cliente") as string, taxId, email: s(v.email), phone: s(v.phone) };
      if (opts.dryRun) {
        if (existing) result.updated++;
        else result.created++;
      } else if (existing) {
        await tx.update(contacts).set(Object.fromEntries(Object.entries(values).filter(([, x]) => x != null))).where(eq(contacts.id, existing.id));
        result.updated++;
      } else {
        const [c] = await tx.insert(contacts).values(values).returning({ id: contacts.id });
        if (s(v.street) || s(v.city)) {
          await tx.insert(contactAddresses).values({ contactId: c!.id, line1: s(v.street) ?? s(v.city)!, city: s(v.city) ?? "", postalCode: s(v.postalCode) ?? "", province: s(v.province) ?? "", isDefault: true });
        }
        result.created++;
      }
    } else {
      const start = v.start as Date;
      const end = v.end as Date;
      const number = s(v.number);
      const [existing] = number ? await tx.select({ id: projects.id }).from(projects).where(eq(projects.number, number)) : [];
      if (opts.dryRun) {
        if (existing) result.updated++;
        else result.created++;
        continue;
      }
      let clientId: string | null = null;
      if (s(v.customer)) {
        const [c] = await tx.select({ id: contacts.id }).from(contacts).where(ilike(contacts.name, s(v.customer)!));
        clientId = c?.id ?? (await tx.insert(contacts).values({ name: s(v.customer)!, kind: "cliente" }).returning({ id: contacts.id }))[0]!.id;
      }
      if (existing) {
        await tx.update(projects).set({ name: String(v.name), startsAt: start, endsAt: end, clientId: clientId ?? undefined, locationAddress: s(v.location) ?? undefined }).where(eq(projects.id, existing.id));
        result.updated++;
        continue;
      }
      const pn = number ?? `P-IMP-${String(await nextCounter(tx, "proyecto")).padStart(4, "0")}`;
      const [p] = await tx.insert(projects).values({ number: pn, name: String(v.name), clientId, status: "consulta", startsAt: start, endsAt: end, locationAddress: s(v.location) }).returning({ id: projects.id });
      await tx.insert(projectPhases).values({ projectId: p!.id, kind: "evento", startsAt: start, endsAt: end });
      const on = String(await nextCounter(tx, "pedido"));
      await tx.insert(orders).values({ projectId: p!.id, number: on, title: String(v.name), status: "borrador", clientId, periodStart: start, periodEnd: end, eventStart: start, eventEnd: end, notes: "Importado: añade las carpas y artículos" });
      result.created++;
    }
  }
  if (!opts.dryRun) await audit(tx, ctx, entity === "inventario" ? "item" : entity === "contactos" ? "contact" : "project", "importacion", "importar", { creados: result.created, actualizados: result.updated, omitidos: result.skipped });
  return result;
}
