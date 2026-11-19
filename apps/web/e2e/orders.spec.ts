import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("pedidos y disponibilidad", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("criterio: con 30 de 49 cerchas ocupadas, un pedido de 21 muestra «Faltan 2» y los causantes", async ({ page }) => {
    await page.goto("/app/pedidos");
    await page.getByPlaceholder("Buscar por número, título o cliente…").fill("Feria del Queso");
    await page.getByRole("link", { name: /Feria del Queso/ }).first().click();
    await expect(page.getByText("Faltan 2").first()).toBeVisible();
    await page.locator("tbody tr").first().click();
    const timeline = page.getByLabel(/Línea de tiempo de Cercha 10 m/);
    await expect(timeline).toBeVisible();
    await expect(timeline.getByText(/Mercado navideño/).first()).toBeVisible();
    await expect(timeline.getByText(/Cena de Navidad/).first()).toBeVisible();
    await expect(timeline.getByText("-2").first()).toBeVisible();
  });

  test("criterio: configurar una 15x30 con pesos, frentes completos, 3 tramos transparentes y el último sin techo en menos de 2 minutos", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/app/pedidos/nuevo");
    await page.getByLabel("Título del evento").fill(`E2E carpa 15x30 ${Date.now()}`);
    await page.getByLabel("Empezar con").selectOption({ label: "Carpa 15 m pata baja" });
    await page.getByRole("button", { name: "Crear pedido" }).click();
    await page.waitForURL(/\/app\/pedidos\/[0-9a-f-]{36}$/);
    await page.locator("tbody tr").first().click();
    const add = page.getByRole("button", { name: "Añadir módulo" }).last();
    await add.click();
    await add.click();
    await expect(page.getByText("6 módulos · 7 pórticos")).toBeVisible();
    await page.getByLabel("Fijación").selectOption("pesos");
    await page.getByText("Tramo a tramo").click();
    for (let i = 1; i <= 3; i++) {
      await page.getByLabel(`Lateral izquierdo tramo ${i}`).selectOption("transparente");
      await page.getByLabel(`Lateral derecho tramo ${i}`).selectOption("transparente");
    }
    await page.getByLabel("Techo tramo 6").selectOption("ninguno");
    await page.getByRole("button", { name: "Ver despiece" }).click();
    const table = page.locator("table").first();
    await expect(table.getByText("Cercha 15 m pata baja")).toBeVisible();
    await expect(table.locator("tr", { hasText: "Cercha 15 m pata baja" }).getByText("7", { exact: true })).toBeVisible();
    await expect(table.locator("tr", { hasText: "Lateral 5 m pata baja transparente" }).getByText("6", { exact: true })).toBeVisible();
    await expect(table.locator("tr", { hasText: "Lona de techo 15x5 blanco" }).getByText("5", { exact: true })).toBeVisible();
    await expect(table.locator("tr", { hasText: "Peso de hormigón 500 kg" }).getByText("28", { exact: true })).toBeVisible();
    await expect(page.getByText("Guardado", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Totales").getByText("Total", { exact: true })).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(120_000);
  });
});
