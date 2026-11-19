import "server-only";
import { randomBytes } from "node:crypto";
import { eq, inArray, orderLines, tentConfigurations, type Tx } from "@rentevent/db";
import { syncReservations } from "@rentevent/db/services";
import { validateConfiguration } from "@rentevent/core";
import { materialOf, pricedRows, tentLabel, type WorkLine } from "@/lib/order-model";
import { UserError } from "./action";
import { loadCatalogue } from "./orders";

/** Writes lines, tent configurations and BOM sub-lines; the server recomputes everything. */
export async function persistLines(tx: Tx, orderId: string, lines: WorkLine[]): Promise<Record<string, string>> {
  const configIds: Record<string, string> = {};
  const cat = await loadCatalogue(tx);
  const { boms } = materialOf(lines, cat);
  const famById = new Map(cat.families.map((f) => [f.id, f]));
  for (const l of lines) {
    if (l.kind !== "carpa") continue;
    for (const t of l.composition.tents) {
      const f = famById.get(t.config.familyId);
      if (!f) throw new UserError("Una carpa usa una familia que ya no existe");
      const issues = validateConfiguration(t.config, f).filter((i) => i.path !== "interior.stage");
      if (issues.length) throw new UserError(`${t.label || f.name}: ${issues[0]!.message}`);
    }
  }
  const rows = pricedRows(lines, cat, boms);
  const keepConfigs = lines.filter((l) => l.kind === "carpa" && l.tentConfigId).map((l) => (l as { tentConfigId: string }).tentConfigId);
  await tx.delete(orderLines).where(eq(orderLines.orderId, orderId));
  const existing = await tx.select({ id: tentConfigurations.id }).from(tentConfigurations).where(eq(tentConfigurations.orderId, orderId));
  const drop = existing.map((e) => e.id).filter((id) => !keepConfigs.includes(id));
  if (drop.length) await tx.delete(tentConfigurations).where(inArray(tentConfigurations.id, drop));
  let sort = 0;
  const itemName = new Map(cat.items.map((i) => [i.id, i.name]));
  for (const l of lines) {
    if (l.kind === "carpa") {
      const bom = boms.get(l.key)!;
      const metrics = { superficie: bom.totals.superficie, totals: { weightKg: bom.totals.weightKg, volumeM3: bom.totals.volumeM3 }, labor: { montajeHoras: bom.totals.montajeHoras, desmontajeHoras: bom.totals.desmontajeHoras }, collisions: bom.collisions, tents: bom.tents.map((t) => ({ id: t.id, metrics: t.result.metrics, vehicles: t.result.vehicles })) };
      let tcId = l.tentConfigId;
      const label = tentLabel(l, cat);
      if (tcId) await tx.update(tentConfigurations).set({ composition: l.composition, bom: bom.lines, metrics, label }).where(eq(tentConfigurations.id, tcId));
      else tcId = (await tx.insert(tentConfigurations).values({ orderId, composition: l.composition, bom: bom.lines, metrics, label, shareToken: randomBytes(12).toString("base64url") }).returning({ id: tentConfigurations.id }))[0]!.id;
      configIds[l.key] = tcId;
      const mine = rows.filter((r) => r.lineKey === l.key);
      const parent = mine.find((r) => r.parent) ?? mine[0];
      const [p] = await tx
        .insert(orderLines)
        .values({ orderId, kind: "carpa", tentConfigId: tcId, description: parent?.description ?? label, quantity: parent?.quantity ?? 1, unitPrice: parent?.unitPrice ?? 0, priceMode: parent?.priceMode ?? "unidad", discountPct: l.discountPct, sortOrder: sort++ })
        .returning({ id: orderLines.id });
      for (const r of mine.filter((x) => x !== parent)) {
        await tx.insert(orderLines).values({ orderId, parentLineId: p!.id, kind: r.kind, itemId: r.itemId, tentConfigId: tcId, description: r.description, quantity: r.quantity, unitPrice: r.unitPrice, priceMode: r.priceMode, discountPct: r.discountPct, sortOrder: sort++ });
      }
      for (const b of bom.lines) {
        await tx.insert(orderLines).values({ orderId, parentLineId: p!.id, kind: "articulo", itemId: b.itemId, tentConfigId: tcId, description: itemName.get(b.itemId) ?? "Artículo", quantity: b.quantity, priceMode: "incluido", fromBom: true, sortOrder: sort++ });
      }
    } else if (l.kind === "articulo") {
      const it = cat.items.find((i) => i.id === l.itemId);
      await tx.insert(orderLines).values({ orderId, kind: "articulo", itemId: l.itemId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: l.priceMode, discountPct: l.discountPct, unitCost: it?.costPrice ?? 0, sortOrder: sort++ });
    } else if (l.kind === "kit") {
      const kit = cat.kits.find((k) => k.id === l.kitId);
      const [p] = await tx.insert(orderLines).values({ orderId, kind: "kit", kitId: l.kitId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: "unidad", discountPct: l.discountPct, sortOrder: sort++ }).returning({ id: orderLines.id });
      for (const ki of kit?.items ?? []) {
        await tx.insert(orderLines).values({ orderId, parentLineId: p!.id, kind: "articulo", itemId: ki.itemId, description: itemName.get(ki.itemId) ?? "Artículo", quantity: ki.quantity * l.quantity, priceMode: "incluido", fromBom: true, sortOrder: sort++ });
      }
    } else {
      await tx.insert(orderLines).values({ orderId, kind: l.kind, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: l.priceMode, discountPct: l.discountPct, unitCost: l.unitCost, sortOrder: sort++ });
    }
  }
  await syncReservations(tx, orderId);
  return configIds;
}

