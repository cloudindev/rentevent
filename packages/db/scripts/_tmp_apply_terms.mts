import pg from "pg";
import { readFileSync } from "node:fs";
import "./env";
const [tenant, file, mode] = process.argv.slice(2);
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL!.includes("localhost") ? false : { rejectUnauthorized: false } });
await c.connect();
const before = (await c.query(`select quote_terms, quote_validity_days, pricing->'depositPct' dep from tenant_settings where tenant_id=$1`, [tenant])).rows[0];
if (!before) throw new Error("no tenant");
if (mode === "restore") {
  const b = JSON.parse(readFileSync(file, "utf8"));
  await c.query(`update tenant_settings set quote_terms=$2, quote_validity_days=$3, pricing = pricing - 'depositPct' where tenant_id=$1`, [tenant, b.quote_terms, b.quote_validity_days]);
} else {
  console.log("BEFORE", JSON.stringify(before));
  const terms = readFileSync(file, "utf8").trim();
  await c.query(`update tenant_settings set quote_terms=$2, quote_validity_days=7, pricing = jsonb_set(pricing, '{depositPct}', '50'::jsonb) where tenant_id=$1`, [tenant, terms]);
}
const after = (await c.query(`select length(quote_terms) len, left(quote_terms, 60) start, quote_validity_days days, pricing->'depositPct' dep from tenant_settings where tenant_id=$1`, [tenant])).rows[0];
console.log("AFTER", JSON.stringify(after));
await c.end();
