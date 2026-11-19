import "server-only";
import { asc, contacts, desc, eq, kitItems, kits, orderLines, orders, projects, quotes, tenantSettings, tentConfigurations, venues, type Tx } from "@rentevent/db";
import { loadAvailabilityInputs, marginMinutes } from "@rentevent/db/services";
import { compositionSchema, DEFAULT_PRICING, haversineKm, roadKm, type PricingSettings } from "@rentevent/core";
import type { Catalogue, WorkLine } from "@/lib/order-model";
import { loadCatalog } from "./catalog";

export async function loadCatalogue(tx: Tx): Promise<Catalogue> {
  const cat = await loadCatalog(tx);
  const [ks, kis] = await Promise.all([tx.select().from(kits).orderBy(asc(kits.name)), tx.select().from(kitItems)]);
  const gutterItem = cat.items.find((i) => i.role === "canalon");
  return {
    families: cat.families,
    rules: cat.rules,
    items: cat.items,
    vehicles: cat.vehicles,
    kits: ks.map((k) => ({ id: k.id, sku: k.sku, name: k.name, price: Number(k.price), items: kis.filter((x) => x.kitId === k.id).map((x) => ({ itemId: x.itemId, quantity: Number(x.quantity) })) })),
    gutter: gutterItem ? { itemId: gutterItem.id, unitLength: gutterItem.weightKg > 0 ? 5 : 5 } : null,
  };
}

export async function tenantPricing(tx: Tx): Promise<{ pricing: PricingSettings; base: { lat: number; lng: number } | null; terms: string; validity: number; optionDays: number }> {
  const [s] = await tx.select().from(tenantSettings);
  return {
    pricing: { ...DEFAULT_PRICING, ...((s?.pricing as Partial<PricingSettings>) ?? {}) },
    base: s?.baseLat != null && s?.baseLng != null ? { lat: s.baseLat, lng: s.baseLng } : null,
    terms: s?.quoteTerms ?? "",
    validity: s?.quoteValidityDays ?? 30,
    optionDays: s?.optionExpiryDays ?? 7,
  };
}

/** Rebuilds the editable work lines from the stored order. */
export async function loadWorkLines(tx: Tx, orderId: string): Promise<WorkLine[]> {
  const [ls, tcs] = await Promise.all([
    tx.select().from(orderLines).where(eq(orderLines.orderId, orderId)).orderBy(asc(orderLines.sortOrder)),
    tx.select().from(tentConfigurations).where(eq(tentConfigurations.orderId, orderId)),
  ]);
  const out: WorkLine[] = [];
  for (const l of ls) {
    if (l.parentLineId) continue;
    if (l.kind === "carpa" && l.tentConfigId) {
      const tc = tcs.find((t) => t.id === l.tentConfigId);
      const parsed = tc ? compositionSchema.safeParse(tc.composition) : null;
      if (!tc || !parsed?.success) continue;
      out.push({ key: l.id, kind: "carpa", tentConfigId: tc.id, label: tc.label, composition: parsed.data, unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct) });
    } else if (l.kind === "articulo" && l.itemId) {
      out.push({ key: l.id, kind: "articulo", itemId: l.itemId, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), priceMode: l.priceMode as "unidad", discountPct: Number(l.discountPct) });
    } else if (l.kind === "kit" && l.kitId) {
      out.push({ key: l.id, kind: "kit", kitId: l.kitId, description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountPct: Number(l.discountPct) });
    } else if (["servicio", "transporte", "mano_obra", "texto"].includes(l.kind)) {
      out.push({ key: l.id, kind: l.kind as "servicio", description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), priceMode: l.priceMode as "unidad", discountPct: Number(l.discountPct), unitCost: Number(l.unitCost) });
    }
  }
  return out;
}

export async function loadOrderWorkspace(tx: Tx, orderId: string) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  const [[project], cat, pricing, lines, qs, margin] = await Promise.all([
    tx.select().from(projects).where(eq(projects.id, order.projectId)),
    loadCatalogue(tx),
    tenantPricing(tx),
    loadWorkLines(tx, orderId),
    tx.select().from(quotes).where(eq(quotes.orderId, orderId)).orderBy(desc(quotes.version)),
    marginMinutes(tx),
  ]);
  const [client] = order.clientId ? await tx.select().from(contacts).where(eq(contacts.id, order.clientId)) : [undefined];
  const [venue] = project?.venueId ? await tx.select().from(venues).where(eq(venues.id, project.venueId)) : [undefined];
  const inputs = await loadAvailabilityInputs(tx, cat.items.map((i) => i.id), { start: order.periodStart, end: order.periodEnd }, margin);
  let distanceKm = project?.distanceKm ?? null;
  if (distanceKm == null && pricing.base && (venue?.lat ?? project?.lat) != null) {
    distanceKm = roadKm(haversineKm(pricing.base, { lat: (venue?.lat ?? project?.lat)!, lng: (venue?.lng ?? project?.lng)! }));
  }
  const clients = await tx.select({ id: contacts.id, name: contacts.name, discountPct: contacts.discountPct }).from(contacts).where(eq(contacts.kind, "cliente")).orderBy(asc(contacts.name));
  const venueList = await tx.select({ id: venues.id, name: venues.name, anchoringAllowed: venues.anchoringAllowed }).from(venues).orderBy(asc(venues.name));
  return {
    order: {
      id: order.id,
      number: order.number,
      title: order.title,
      status: order.status,
      projectId: order.projectId,
      projectName: project?.name ?? "",
      clientId: order.clientId,
      clientName: client?.name ?? null,
      clientEmail: client?.email ?? null,
      venueId: project?.venueId ?? null,
      venueName: venue?.name ?? project?.locationAddress ?? null,
      anchoringAllowed: venue?.anchoringAllowed ?? true,
      periodStart: order.periodStart.toISOString(),
      periodEnd: order.periodEnd.toISOString(),
      eventStart: order.eventStart?.toISOString() ?? null,
      eventEnd: order.eventEnd?.toISOString() ?? null,
      optionExpiresAt: order.optionExpiresAt?.toISOString() ?? null,
      discountPct: Number(order.discountPct),
      holiday: order.holiday,
      trips: order.trips,
      notes: order.notes,
      distanceKm,
      updatedAt: order.updatedAt.toISOString(),
    },
    lines,
    catalogue: cat,
    pricing: pricing.pricing,
    terms: pricing.terms,
    marginMinutes: margin,
    availability: {
      stocks: [...inputs.stocks.values()],
      reservations: inputs.reservations,
      subrentals: inputs.subrentals,
    },
    quotes: qs.map((q) => ({ id: q.id, version: q.version, number: q.number, status: q.status, total: Number(q.total), sentAt: q.sentAt?.toISOString() ?? null, acceptedAt: q.acceptedAt?.toISOString() ?? null, publicToken: q.publicToken, createdAt: q.createdAt.toISOString() })),
    clients: clients.map((c) => ({ ...c, discountPct: Number(c.discountPct) })),
    venues: venueList,
  };
}

export type OrderWorkspaceData = NonNullable<Awaited<ReturnType<typeof loadOrderWorkspace>>>;
