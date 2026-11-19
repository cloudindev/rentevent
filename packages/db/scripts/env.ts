import { config } from "dotenv";
import { resolve } from "node:path";

// Load the repo-root .env, then the web app's, without overriding real env vars.
config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
config({ path: resolve(import.meta.dirname, "../../../apps/web/.env.local"), quiet: true });
process.env.DATABASE_URL ??= "postgres://localhost:5432/rentevent";
