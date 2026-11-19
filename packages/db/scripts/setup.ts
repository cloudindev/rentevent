/** Creates the local databases (rentevent and rentevent_test). `--reset` drops them first. */
import "./env";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL!);
const reset = process.argv.includes("--reset");
const names = [url.pathname.slice(1) || "rentevent", `${url.pathname.slice(1) || "rentevent"}_test`];

if (/supabase|neon|rds\.amazonaws/.test(url.host)) {
  console.log("Base de datos gestionada detectada: no se crean ni borran bases de datos.");
  process.exit(0);
}

const admin = new URL(url);
admin.pathname = "/postgres";
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
for (const name of names) {
  if (reset) {
    await client.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [name]);
    await client.query(`drop database if exists "${name}"`);
  }
  const exists = await client.query("select 1 from pg_database where datname = $1", [name]);
  if (exists.rowCount === 0) {
    await client.query(`create database "${name}"`);
    console.log(`Base de datos ${name} creada`);
  } else console.log(`Base de datos ${name} ya existe`);
}
await client.end();
