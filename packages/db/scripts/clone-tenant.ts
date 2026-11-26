/**
 * Clones a whole company (tenant) into a new, independent one, and creates its
 * first administrator by copying an existing user's profile and password.
 *
 *   pnpm tsx scripts/clone-tenant.ts <fromTenantId> <fromUserEmail> <newEmail> <newSlug> [--apply]
 *
 * Every row gets a new id and every reference to a copied id is rewritten
 * (columns, arrays and JSON alike). Files stored in Postgres are copied under
 * the new tenant prefix. Not copied: API keys, webhooks, push subscriptions,
 * queued jobs/emails and other users' memberships. Public share tokens are
 * regenerated. Without --apply it runs inside a transaction and rolls back.
 */
import "./env";
import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { closeDb, getPool } from "../src/client";

const [fromTenant, fromEmail, newEmail, newSlug] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
if (!fromTenant || !fromEmail || !newEmail || !newSlug) {
  console.error("Uso: clone-tenant.ts <fromTenantId> <fromUserEmail> <newEmail> <newSlug> [--apply]");
  process.exit(1);
}

const SKIP = new Set(["jobs", "outbox_emails", "api_keys", "webhooks", "webhook_deliveries", "push_subscriptions", "notifications"]);
/** globally unique values that must not be shared with the original */
const REGENERATE: Record<string, Record<string, () => string>> = {
  quotes: { public_token: () => randomBytes(24).toString("base64url") },
  tent_configurations: { share_token: () => randomBytes(24).toString("base64url") },
  job_reports: { client_ref: () => randomUUID() },
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

type Col = { name: string; type: string; nullable: boolean };
type Fk = { table: string; column: string; ref: string; notNull: boolean };

async function main(c: PoolClient) {
  const [src] = (await c.query(`select * from organization where id = $1`, [fromTenant])).rows;
  if (!src) throw new Error(`No existe la empresa ${fromTenant}`);
  const [fromUser] = (await c.query(`select * from "user" where email = $1`, [fromEmail])).rows;
  if (!fromUser) throw new Error(`No existe el usuario ${fromEmail}`);
  if ((await c.query(`select 1 from "user" where email = $1`, [newEmail])).rowCount) throw new Error(`Ya existe un usuario con ${newEmail}`);
  if ((await c.query(`select 1 from organization where slug = $1`, [newSlug])).rowCount) throw new Error(`El subdominio ${newSlug} ya está en uso`);

  const newTenant = `org_${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;
  const newUser = `usr_${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;

  // ── schema: tenant tables, their columns and the foreign keys between them
  const tables = (
    await c.query(`select table_name from information_schema.columns where table_schema='public' and column_name='tenant_id' order by 1`)
  ).rows.map((r) => r.table_name as string).filter((t) => !SKIP.has(t));
  const cols = new Map<string, Col[]>();
  for (const t of tables) {
    const rows = (await c.query(`select column_name, data_type, udt_name, is_nullable from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`, [t])).rows;
    cols.set(t, rows.map((r) => ({ name: r.column_name, type: r.data_type === "ARRAY" ? `${r.udt_name.slice(1)}[]` : r.data_type === "USER-DEFINED" ? r.udt_name : r.data_type, nullable: r.is_nullable === "YES" })));
  }
  const fks: Fk[] = (
    await c.query(`
      select c.conrelid::regclass::text as table, a.attname as column, c.confrelid::regclass::text as ref, a.attnotnull as "notNull"
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace`)
  ).rows.map((r) => ({ ...r, table: r.table.replace(/"/g, ""), ref: r.ref.replace(/"/g, "") }));
  const inSet = new Set(tables);
  // nullable references are filled in a second pass, so only NOT NULL ones order the inserts
  const deferred = fks.filter((f) => inSet.has(f.table) && inSet.has(f.ref) && !f.notNull);
  const order: string[] = [];
  const pending = new Set(tables);
  while (pending.size) {
    const ready = [...pending].filter((t) => fks.every((f) => f.table !== t || !f.notNull || f.ref === t || !pending.has(f.ref) || !inSet.has(f.ref)));
    if (!ready.length) throw new Error(`Dependencias circulares entre: ${[...pending].join(", ")}`);
    for (const t of ready) {
      order.push(t);
      pending.delete(t);
    }
  }

  // ── read everything and build the id map
  const data = new Map<string, Record<string, unknown>[]>();
  const idMap = new Map<string, string>();
  for (const t of order) {
    const rows = (await c.query(`select * from "${t}" where tenant_id = $1`, [fromTenant])).rows;
    data.set(t, rows);
    if (cols.get(t)!.some((x) => x.name === "id" && x.type === "uuid")) for (const r of rows) idMap.set(r.id as string, randomUUID());
  }
  const oldUser = fromUser.id as string;
  const rewriteStr = (s: string) => s.replace(UUID, (m) => idMap.get(m) ?? m).split(fromTenant!).join(newTenant).split(oldUser).join(newUser);
  const rewrite = (v: unknown): unknown => {
    if (v === null || v === undefined || v instanceof Date || typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "string") return rewriteStr(v);
    if (Buffer.isBuffer(v)) return v;
    return JSON.parse(rewriteStr(JSON.stringify(v)));
  };

  // ── the new company and user first: every copied row references them
  await c.query(`insert into organization (id, name, slug, logo, created_at, metadata) values ($1, $2, $3, $4, now(), $5)`, [newTenant, src.name, newSlug, src.logo ? rewriteStr(src.logo) : null, src.metadata ? rewriteStr(src.metadata) : null]);
  await c.query(`insert into "user" (id, name, email, email_verified, image, locale, created_at, updated_at) values ($1, $2, $3, true, $4, $5, now(), now())`, [newUser, fromUser.name, newEmail, fromUser.image, fromUser.locale ?? "es"]);
  // ── pass 1: insert (deferred references as null)
  let total = 0;
  for (const t of order) {
    const tc = cols.get(t)!;
    const defer = new Set(deferred.filter((f) => f.table === t).map((f) => f.column));
    const userFks = new Set(fks.filter((f) => f.table === t && f.ref === "user").map((f) => f.column));
    for (const row of data.get(t)!) {
      const values = tc.map((col) => {
        let v = rewrite(row[col.name]);
        if (col.name === "tenant_id") v = newTenant;
        if (defer.has(col.name)) v = null;
        if (userFks.has(col.name) && v !== null && v !== newUser) v = null; // other people's accounts are not part of the copy
        const regen = REGENERATE[t]?.[col.name];
        if (regen && v !== null) v = regen();
        if ((col.type === "jsonb" || col.type === "json") && v !== null) v = JSON.stringify(v);
        return v;
      });
      const ph = tc.map((col, i) => `$${i + 1}${col.type === "jsonb" ? "::jsonb" : ""}`);
      await c.query(`insert into "${t}" (${tc.map((x) => `"${x.name}"`).join(", ")}) values (${ph.join(", ")})`, values);
      total++;
    }
  }
  // ── pass 2: nullable references between copied rows
  for (const f of deferred) {
    const pairs = data
      .get(f.table)!
      .filter((r) => r[f.column] && idMap.has(r[f.column] as string) && idMap.has(r.id as string))
      .map((r) => [idMap.get(r.id as string)!, idMap.get(r[f.column] as string)!]);
    if (!pairs.length) continue;
    await c.query(`update "${f.table}" t set "${f.column}" = v.ref from unnest($1::uuid[], $2::uuid[]) as v(id, ref) where t.id = v.id`, [pairs.map((p) => p[0]), pairs.map((p) => p[1])]);
  }

  // ── files stored in Postgres (keys are prefixed with the tenant id)
  const blobs = await c.query(`insert into blobs (key, content_type, size, data, created_at) select replace(key, $1, $2), content_type, size, data, created_at from blobs where key like $1 || '/%' on conflict do nothing`, [fromTenant, newTenant]);

  // ── company, user, password and membership
  const [cred] = (await c.query(`select password from account where user_id = $1 and provider_id = 'credential'`, [fromUser.id])).rows;
  if (!cred?.password) throw new Error("El usuario de origen no tiene contraseña");
  await c.query(`insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at) values ($1, $2, 'credential', $2, $3, now(), now())`, [randomUUID(), newUser, cred.password]);
  await c.query(`insert into member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, 'administrador', now())`, [randomUUID(), newTenant, newUser]);

  return { newTenant, newUser, rows: total, tables: order.length, blobs: blobs.rowCount ?? 0 };
}

const client = await getPool().connect();
try {
  await client.query("begin");
  const r = await main(client);
  await client.query(apply ? "commit" : "rollback");
  console.log(apply ? "Copia creada:" : "Prueba (sin guardar):", r);
} catch (e) {
  await client.query("rollback");
  console.error("Error, no se ha cambiado nada:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  client.release();
  await closeDb();
}
