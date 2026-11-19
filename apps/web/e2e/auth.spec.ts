import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("acceso con la cuenta demo y navegación por la barra lateral", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.getByRole("link", { name: "Inventario" }).click();
  await expect(page).toHaveURL(/inventario/);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByPlaceholder(/Busca pedidos/)).toBeVisible();
});

test("credenciales incorrectas muestran un error", async ({ page }) => {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill("nadie@ejemplo.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta-123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
