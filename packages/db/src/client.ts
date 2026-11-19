import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const DEFAULT_URL = "postgres://localhost:5432/rentevent";

type Holder = { pool?: pg.Pool; db?: Database };
const g = globalThis as unknown as { __rentevent_db?: Holder };
const holder: Holder = (g.__rentevent_db ??= {});

export function getPool(): pg.Pool {
  if (!holder.pool) {
    const url = process.env.DATABASE_URL ?? DEFAULT_URL;
    holder.pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
      ssl: /supabase|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return holder.pool;
}

/**
 * Privileged connection: bypasses RLS. Only for auth, signup, background jobs,
 * migrations and seed. Request handlers must use `withTenant`.
 */
export function systemDb(): Database {
  if (!holder.db) holder.db = drizzle(getPool(), { schema, casing: "snake_case" });
  return holder.db;
}

export const APP_ROLE = "rentevent_app";

/**
 * Runs `fn` in a transaction as the unprivileged role with `app.tenant_id`
 * set, so PostgreSQL Row Level Security confines every statement to the
 * tenant. Works through transaction poolers because both settings are LOCAL.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!tenantId) throw new Error("withTenant: tenantId requerido");
  return systemDb().transaction(async (tx) => {
    // one round trip: `set_config('role', …, true)` is the function form of SET LOCAL ROLE
    await tx.execute(sql`select set_config('role', ${APP_ROLE}, true), set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

export async function closeDb() {
  await holder.pool?.end();
  holder.pool = undefined;
  holder.db = undefined;
}

export { schema };
