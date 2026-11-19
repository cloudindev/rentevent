/** Dev helper: opens an order, clicks the first tent row and screenshots the configurator. */
import { chromium } from "@playwright/test";
const base = "http://localhost:3210";
const [orderId] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1500 } })).newPage();
await page.request.post(`${base}/api/auth/sign-in/email`, { data: { email: "demo@rentevent.es", password: "Rentevent2026!" }, headers: { Origin: base } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/app/pedidos/${orderId}`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(2000);
await page.locator("tbody tr").first().click();
await page.waitForTimeout(6000);
await page.screenshot({ path: "/tmp/order-config.png", fullPage: true });
console.log("/tmp/order-config.png", errors.join("\n"));
await browser.close();
