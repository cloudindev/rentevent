import type { Page } from "@playwright/test";

export const DEMO = { email: "demo@rentevent.es", password: "Rentevent2026!" };

/** Signs in through the UI (login form). */
export async function login(page: Page, email = DEMO.email, password = DEMO.password) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.waitForURL(/\/app\//, { timeout: 60_000 });
}
