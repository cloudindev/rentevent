import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { closeDb, systemDb, withTenant } from "../src/client";
import { contacts, items, member, organization, user } from "../src/schema";

async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as { message: string; cause?: { message: string } };
    return err.cause?.message ?? err.message;
  }
  return "no error";
}

const A = `t-a-${Date.now()}`;
const B = `t-b-${Date.now()}`;

beforeAll(async () => {
  const db = systemDb();
  await db.insert(organization).values([
    { id: A, name: "Carpas A", slug: A },
    { id: B, name: "Carpas B", slug: B },
  ]);
  await db.insert(user).values([
    { id: `${A}-u`, name: "Ana", email: `${A}@test.local` },
    { id: `${B}-u`, name: "Bea", email: `${B}@test.local` },
  ]);
  await db.insert(member).values([
    { id: `${A}-m`, organizationId: A, userId: `${A}-u`, role: "administrador" },
    { id: `${B}-m`, organizationId: B, userId: `${B}-u`, role: "administrador" },
  ]);
  await withTenant(A, (tx) => tx.insert(contacts).values({ name: "Cliente de A" }));
  await withTenant(B, (tx) => tx.insert(contacts).values({ name: "Cliente de B" }));
});

afterAll(async () => {
  await systemDb().delete(organization).where(sql`${organization.id} in (${A}, ${B})`);
  await systemDb().delete(user).where(sql`${user.id} in (${A + "-u"}, ${B + "-u"})`);
  await closeDb();
});

describe("row level security", () => {
  it("a tenant only reads its own rows", async () => {
    const seenByA = await withTenant(A, (tx) => tx.select().from(contacts));
    expect(seenByA.map((c) => c.name)).toEqual(["Cliente de A"]);
    const seenByB = await withTenant(B, (tx) => tx.select().from(contacts));
    expect(seenByB.map((c) => c.name)).toEqual(["Cliente de B"]);
  });

  it("tenant_id defaults to the session tenant", async () => {
    const [row] = await withTenant(A, (tx) => tx.insert(items).values({ sku: "X1", name: "Cercha" }).returning());
    expect(row!.tenantId).toBe(A);
  });

  it("cannot write rows into another tenant", async () => {
    expect(await pgError(withTenant(A, (tx) => tx.insert(contacts).values({ tenantId: B, name: "Intruso" })))).toMatch(/row-level security/);
  });

  it("cannot update or delete another tenant's rows", async () => {
    const [bRow] = await systemDb().select().from(contacts).where(eq(contacts.tenantId, B));
    const updated = await withTenant(A, (tx) => tx.update(contacts).set({ name: "hackeado" }).where(eq(contacts.id, bRow!.id)).returning());
    expect(updated).toEqual([]);
    const deleted = await withTenant(A, (tx) => tx.delete(contacts).where(eq(contacts.id, bRow!.id)).returning());
    expect(deleted).toEqual([]);
    const [still] = await systemDb().select().from(contacts).where(eq(contacts.id, bRow!.id));
    expect(still!.name).toBe("Cliente de B");
  });

  it("cannot escape by changing the tenant setting to another tenant without the role", async () => {
    const rows = await withTenant(A, async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${B}, true)`);
      return tx.select().from(contacts);
    });
    // switching the variable is only possible inside server code; still confined to one tenant at a time
    expect(rows.every((r) => r.tenantId === B)).toBe(true);
    await expect(withTenant(A, (tx) => tx.execute(sql`reset role`).then(() => tx.execute(sql`set role postgres`)))).rejects.toThrow();
  });

  it("sees other tenants' organizations and users as nothing", async () => {
    const orgs = await withTenant(A, (tx) => tx.select().from(organization));
    expect(orgs.map((o) => o.id)).toEqual([A]);
    const users = await withTenant(A, (tx) => tx.select({ id: user.id }).from(user));
    expect(users.map((u) => u.id)).toEqual([`${A}-u`]);
  });

  it("system tables are not reachable from the app role", async () => {
    expect(await pgError(withTenant(A, (tx) => tx.execute(sql`select * from jobs`)))).toMatch(/permission denied/);
  });

  it("requires a tenant", async () => {
    await expect(withTenant("", async () => 1)).rejects.toThrow(/tenantId/);
    const none = await systemDb().transaction(async (tx) => {
      await tx.execute(sql`set local role rentevent_app`);
      return tx.select().from(contacts);
    });
    expect(none).toEqual([]);
  });
});
