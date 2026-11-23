/**
 * Demo for serial tracking: wireless microphones packed in sets (mic +
 * receiver + 2 batteries), and sets packed in flight cases with XLR cables.
 * Idempotent per tenant: does nothing if the microphones already exist.
 */
import { eq } from "drizzle-orm";
import type { Tx } from "../src/client";
import * as s from "../src/schema";

const P = { costPrice: 0, replacementCost: 0 };

export async function seedTracking(tx: Tx, warehouseId: string | null) {
  const [exists] = await tx.select({ id: s.items.id }).from(s.items).where(eq(s.items.sku, "MIC-IN"));
  if (exists) return false;
  const item = async (v: { sku: string; name: string; kind: string; price: number; priceMode: string; stock: number; weightKg: number; location: string; container?: string; replacementCost?: number }) => {
    const [row] = await tx
      .insert(s.items)
      .values({ sku: v.sku, name: v.name, category: "Sonido", kind: v.kind, unit: "ud", price: v.price, priceMode: v.priceMode, stockTotal: v.stock, weightKg: v.weightKg, volumeM3: 0.002, warehouseId, location: v.location, container: v.container ?? null, ...P, replacementCost: v.replacementCost ?? 0, inspectionIntervalDays: v.kind === "seriado" && !v.container ? 365 : null })
      .returning({ id: s.items.id });
    return row!.id;
  };
  const mic = await item({ sku: "MIC-IN", name: "Micrófono inalámbrico de mano", kind: "seriado", price: 25, priceMode: "dia", stock: 8, weightKg: 0.3, location: "S-01", replacementCost: 420 });
  const rec = await item({ sku: "REC-IN", name: "Receptor de micrófono inalámbrico", kind: "seriado", price: 0, priceMode: "incluido", stock: 8, weightKg: 1.1, location: "S-01", replacementCost: 380 });
  const bat = await item({ sku: "BAT-AA", name: "Pila AA recargable", kind: "consumible", price: 0, priceMode: "incluido", stock: 60, weightKg: 0.03, location: "S-02" });
  const xlr = await item({ sku: "CAB-XLR10", name: "Cable XLR 10 m", kind: "granel", price: 3, priceMode: "unidad", stock: 40, weightKg: 0.6, location: "S-02" });
  const set = await item({ sku: "SET-MIC", name: "Conjunto micro inalámbrico", kind: "seriado", price: 0, priceMode: "incluido", stock: 8, weightKg: 1.5, location: "S-01", container: "conjunto" });
  const fc = await item({ sku: "FC-MIC4", name: "Flight case 4 micros inalámbricos", kind: "seriado", price: 0, priceMode: "incluido", stock: 2, weightKg: 9, location: "S-01", container: "caja" });

  const unit = async (itemId: string, serial: string, parentUnitId: string | null = null, location = "S-01") => {
    const [u] = await tx.insert(s.itemUnits).values({ itemId, serial, qrCode: `RV-${serial}`, status: "disponible", warehouseId, location, parentUnitId, purchasedAt: "2025-03-10" }).returning({ id: s.itemUnits.id });
    await tx.insert(s.unitEvents).values({ unitId: u!.id, kind: "alta", note: "Unidad dada de alta", userName: "Sistema" });
    return u!.id;
  };
  const pad = (n: number) => String(n).padStart(3, "0");
  for (let c = 1; c <= 2; c++) {
    const caseId = await unit(fc, `FC-MIC4-${pad(c)}`);
    await tx.insert(s.unitContents).values({ containerUnitId: caseId, itemId: xlr, quantity: 4 });
    for (let k = 1; k <= 4; k++) {
      const n = (c - 1) * 4 + k;
      const setId = await unit(set, `SET-MIC-${pad(n)}`, caseId);
      await tx.insert(s.unitContents).values({ containerUnitId: setId, itemId: bat, quantity: 2 });
      await unit(mic, `MIC-IN-${pad(n)}`, setId);
      await unit(rec, `REC-IN-${pad(n)}`, setId);
      await tx.insert(s.unitEvents).values({ unitId: setId, kind: "empaquetado", note: `En Flight case 4 micros inalámbricos FC-MIC4-${pad(c)}`, userName: "Sistema" });
    }
  }
  // commercial kit, so orders can add the full set in one line
  const [kit] = await tx.insert(s.kits).values({ sku: "KIT-MIC", name: "Micro inalámbrico completo", price: 35, description: "Micrófono de mano, receptor y pilas recargables" }).returning({ id: s.kits.id });
  await tx.insert(s.kitItems).values([
    { kitId: kit!.id, itemId: mic, quantity: 1 },
    { kitId: kit!.id, itemId: rec, quantity: 1 },
    { kitId: kit!.id, itemId: bat, quantity: 2 },
  ]);
  return true;
}

// pnpm tsx scripts/seed-tracking.ts [tenantId] — adds the demo to an existing tenant
if (import.meta.url === `file://${process.argv[1]}`) {
  await import("./env");
  const { closeDb, withTenant } = await import("../src/client");
  const tenantId = process.argv[2] ?? "org_demo_carpasdelnorte";
  const added = await withTenant(tenantId, async (tx) => {
    const [wh] = await tx.select({ id: s.warehouses.id }).from(s.warehouses).limit(1);
    return seedTracking(tx, wh?.id ?? null);
  });
  console.log(added ? `Demo de seguimiento añadida a ${tenantId}` : "Ya existía; sin cambios");
  await closeDb();
}
