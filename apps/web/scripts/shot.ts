/** Dev helper: logs in as the demo user and screenshots a list of paths. Usage: tsx scripts/shot.ts /app/inicio /acceso */
import { chromium } from "@playwright/test";

const base = process.env.SHOT_BASE ?? "http://localhost:3210";
const out = process.env.SHOT_DIR ?? "/tmp";
const paths = process.argv.slice(2);
const width = Number(process.env.SHOT_W ?? 1440);
const height = Number(process.env.SHOT_H ?? 900);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: (process.env.SHOT_SCHEME as "light" | "dark") ?? "light" });
const page = await ctx.newPage();
if (!process.env.SHOT_ANON) {
  await page.request.post(`${base}/api/auth/sign-in/email`, { data: { email: process.env.SHOT_USER ?? "demo@rentevent.es", password: "Rentevent2026!" }, headers: { Origin: base } });
}
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const p of paths) {
  await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 600));
  const file = `${out}/shot${p.replace(/[^a-z0-9]+/gi, "_")}.png`;
  await page.screenshot({ path: file, fullPage: Boolean(process.env.SHOT_FULL) });
  console.log(file);
}
if (errors.length) console.log("ERRORS:\n" + errors.slice(0, 10).join("\n"));
await browser.close();
