import { expect, test } from "@playwright/test";

test("la portada y precios se muestran", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Prueba gratis/ }).first()).toBeVisible();
  await page.goto("/precios");
  await expect(page.getByText(/Profesional/).first()).toBeVisible();
});

test("las rutas privadas piden acceso", async ({ page }) => {
  await page.goto("/app/pedidos");
  await expect(page).toHaveURL(/\/acceso/);
});
