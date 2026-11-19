import "./env";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getPool, systemDb } from "../src/client";

export async function runMigrations() {
  await migrate(systemDb(), { migrationsFolder: resolve(import.meta.dirname, "../drizzle") });
  const rls = await readFile(resolve(import.meta.dirname, "rls.sql"), "utf8");
  await getPool().query(rls);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  console.log("Migraciones y políticas RLS aplicadas");
  await closeDb();
}
