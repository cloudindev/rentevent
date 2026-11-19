import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { zonedTime } from "@rentevent/core";
import { closeDb, systemDb, withTenant } from "../src/client";
import { items, orderLines, orders, organization, projects, reservations, subrentals, tenantSettings } from "../src/schema";
import { AvailabilityConflictError, availableMap, checkOrderAvailability, expireOptions, itemTimeline, reserveOrder, syncReservations } from "../src/services/reservations";
import { dayCells } from "@rentevent/core";

const T = `t-res-${Date.now()}`;
const d = (day: number, h = 8) => new Date(zonedTime(2026, 12, day, h, 0));
let truss = "";
let shared = "";
let projectId = "";
let seq = 0;

async function newOrder(title: string, qty: number, itemId: string, start: Date, end: Date) {
  return withTenant(T, async (tx) => {
    const [o] = await tx.insert(orders).values({ projectId, number: `N${++seq}`, title, status: "borrador", periodStart: start, periodEnd: end }).returning();
    await tx.insert(orderLines).values({ orderId: o!.id, kind: "articulo", itemId, description: title, quantity: qty });
    return o!.id;
  });
}

beforeAll(async () => {
  await systemDb().insert(organization).values({ id: T, name: "Reservas", slug: T });
  await withTenant(T, async (tx) => {
    await tx.insert(tenantSettings).values({ availabilityMarginMinutes: 60 });
    const [a] = await tx.insert(items).values({ sku: "C10B", name: "Cercha 10 m", stockTotal: 49 }).returning();
    const [b] = await tx.insert(items).values({ sku: "C1014B", name: "Cercha 10/14", stockTotal: 9 }).returning();
    truss = a!.id;
    shared = b!.id;
    const [p] = await tx.insert(projects).values({ number: "P1", name: "Proyecto" }).returning();
    projectId = p!.id;
  });
});

afterAll(async () => {
  await systemDb().delete(organization).where(eq(organization.id, T));
  await closeDb();
});

describe("order reservations (DB)", () => {
  it("acceptance: 30 of 49 trusses confirmed → an order needing 21 is short by 2 and names the culprits", async () => {
    const a = await newOrder("Mercado navideño", 18, truss, d(10), d(15, 18));
    const b = await newOrder("Cena de empresa", 12, truss, d(11), d(14, 18));
    await withTenant(T, (tx) => reserveOrder(tx, a, "confirmado"));
    await withTenant(T, (tx) => reserveOrder(tx, b, "confirmado"));
    const c = await newOrder("Feria del Queso", 21, truss, d(12), d(14, 14));
    const [check] = await withTenant(T, (tx) => checkOrderAvailability(tx, c));
    expect(check).toMatchObject({ requested: 21, available: 19, shortage: 2, status: "short" });
    expect(check!.occupants.map((o) => o.projectName).sort()).toEqual(["Cena de empresa", "Mercado navideño"]);
    await expect(withTenant(T, (tx) => reserveOrder(tx, c, "confirmado"))).rejects.toBeInstanceOf(AvailabilityConflictError);
    // as an enquiry it does not reserve but is stored as potential demand
    await withTenant(T, (tx) => reserveOrder(tx, c, "consulta"));
    const rows = await withTenant(T, (tx) => tx.select().from(reservations).where(eq(reservations.orderId, c)));
    expect(rows.map((r) => r.status)).toEqual(["consulta"]);
    const avail = await withTenant(T, (tx) => availableMap(tx, [truss], { start: d(12), end: d(14) }));
    expect(avail.get(truss)).toBe(19);
  });

  it("two sales people cannot confirm the same trusses concurrently", async () => {
    const x = await newOrder("Concurrente A", 25, truss, d(20), d(22));
    const y = await newOrder("Concurrente B", 25, truss, d(20), d(22));
    const results = await Promise.allSettled([withTenant(T, (tx) => reserveOrder(tx, x, "confirmado")), withTenant(T, (tx) => reserveOrder(tx, y, "confirmado"))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AvailabilityConflictError);
    const confirmed = await withTenant(T, (tx) => tx.select().from(orders).where(eq(orders.status, "confirmado")));
    expect(confirmed.filter((o) => o.title.startsWith("Concurrente"))).toHaveLength(1);
  });

  it("the shared 10/14 truss reserved for a 14 m tent lowers what the 10 m extra can use", async () => {
    const before = await withTenant(T, (tx) => availableMap(tx, [shared], { start: d(5), end: d(7) }));
    const o = await newOrder("Carpa 14x20", 5, shared, d(5), d(7));
    await withTenant(T, (tx) => reserveOrder(tx, o, "confirmado"));
    const after = await withTenant(T, (tx) => availableMap(tx, [shared], { start: d(5), end: d(7) }));
    expect(before.get(shared)).toBe(9);
    expect(after.get(shared)).toBe(4);
  });

  it("return and load on the same day respect the turnaround margin", async () => {
    const ret = await newOrder("Devuelve a las 10", 49, truss, d(24), d(26, 10));
    await withTenant(T, (tx) => reserveOrder(tx, ret, "confirmado"));
    const tooSoon = await newOrder("Carga 10:30", 1, truss, d(26, 10), d(28));
    await withTenant(T, (tx) => tx.update(orders).set({ periodStart: new Date(zonedTime(2026, 12, 26, 10, 30)) }).where(eq(orders.id, tooSoon)));
    expect((await withTenant(T, (tx) => checkOrderAvailability(tx, tooSoon)))[0]!.available).toBe(0);
    await withTenant(T, (tx) => tx.update(orders).set({ periodStart: new Date(zonedTime(2026, 12, 26, 11, 0)) }).where(eq(orders.id, tooSoon)));
    expect((await withTenant(T, (tx) => checkOrderAvailability(tx, tooSoon)))[0]!.available).toBe(49);
  });

  it("options expire back to enquiries and stop reserving", async () => {
    const o = await newOrder("Opción", 10, truss, d(1), d(2));
    await withTenant(T, (tx) => reserveOrder(tx, o, "opcion", { optionExpiresAt: new Date(Date.now() - 1000) }));
    const expired = await withTenant(T, (tx) => expireOptions(tx));
    expect(expired.map((e) => e.id)).toContain(o);
    const rows = await withTenant(T, (tx) => tx.select().from(reservations).where(eq(reservations.orderId, o)));
    expect(rows.map((r) => r.status)).toEqual(["consulta"]);
  });

  it("subrentals add stock and the timeline shows rows per project", async () => {
    await withTenant(T, (tx) => tx.insert(subrentals).values({ itemId: truss, quantity: 3, startsAt: d(12), endsAt: d(14), status: "confirmado" }));
    const days = dayCells("2026-12-11", "2026-12-15");
    const t = await withTenant(T, (tx) => itemTimeline(tx, truss, days, null));
    expect(t.rows.map((r) => r.label)).toEqual(expect.arrayContaining(["Mercado navideño", "Cena de empresa", "Este pedido", "Subalquiler"]));
    expect(t.cells.find((c) => c.day === "2026-12-13")!.subrental).toBe(3);
    const avail = await withTenant(T, (tx) => availableMap(tx, [truss], { start: d(12, 9), end: d(13) }));
    expect(avail.get(truss)).toBe(22);
    const empty = await withTenant(T, (tx) => itemTimeline(tx, truss, [], null));
    expect(empty.rows).toEqual([]);
  });

  it("draft and cancelled orders do not reserve", async () => {
    const o = await newOrder("Borrador", 3, truss, d(1), d(2));
    await withTenant(T, (tx) => syncReservations(tx, o));
    await withTenant(T, (tx) => tx.update(orders).set({ status: "cancelado" }).where(eq(orders.id, o)));
    await withTenant(T, (tx) => syncReservations(tx, o));
    const rows = await withTenant(T, (tx) => tx.select().from(reservations).where(eq(reservations.orderId, o)));
    expect(rows).toEqual([]);
  });
});
