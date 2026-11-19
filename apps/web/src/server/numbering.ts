import "server-only";
import { counters, sql, type Tx } from "@rentevent/db";

/** Atomically increments a per-tenant counter (row lock) and returns the new value. */
export async function nextCounter(tx: Tx, key: string, start = 0): Promise<number> {
  const rows = await tx.execute<{ value: number }>(sql`
    insert into counters (tenant_id, key, value) values (current_setting('app.tenant_id', true), ${key}, ${start + 1})
    on conflict (tenant_id, key) do update set value = counters.value + 1
    returning value`);
  return Number(rows.rows[0]!.value);
}

export const pad = (n: number, len = 4) => String(n).padStart(len, "0");
void counters;
