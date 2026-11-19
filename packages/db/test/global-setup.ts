export default async function setup() {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/rentevent_test";
  const { runMigrations } = await import("../scripts/migrate");
  const { closeDb } = await import("../src/client");
  await runMigrations();
  await closeDb();
}
