import { describe, expect, it } from "vitest";
import { autoMap, mapRows, parseDate, parseNumber, skuFromName } from "./mapping";

describe("import column auto-mapping", () => {
  it("recognises a Rentman equipment export", () => {
    const m = autoMap(["Number", "Name", "Folder", "Current stock", "Weight", "Rental price", "Notes"], "inventario");
    expect(m).toMatchObject({ sku: "Number", name: "Name", category: "Folder", stockTotal: "Current stock", weightKg: "Weight", price: "Rental price" });
  });
  it("recognises Spanish headers with accents and case", () => {
    const m = autoMap(["Código", "NOMBRE", "Categoría", "Cantidad", "Precio alquiler", "Ubicación"], "inventario");
    expect(m).toMatchObject({ sku: "Código", name: "NOMBRE", category: "Categoría", stockTotal: "Cantidad", price: "Precio alquiler", location: "Ubicación" });
  });
  it("maps Rentman contacts and projects", () => {
    expect(autoMap(["Displayname", "VAT number", "Email", "Phone", "Visit street", "Visit city", "Visit postal code"], "contactos")).toMatchObject({ name: "Displayname", taxId: "VAT number", email: "Email", street: "Visit street", city: "Visit city", postalCode: "Visit postal code" });
    expect(autoMap(["Name", "Number", "Planperiod start", "Planperiod end", "Customer"], "proyectos")).toMatchObject({ name: "Name", number: "Number", start: "Planperiod start", end: "Planperiod end", customer: "Customer" });
  });
  it("does not reuse a header twice and leaves unknown fields null", () => {
    const m = autoMap(["Name"], "inventario");
    expect(m.name).toBe("Name");
    expect(m.sku).toBeNull();
  });
});

describe("value parsing and validation", () => {
  it("parses Spanish and English numbers", () => {
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("12,5 €")).toBe(12.5);
    expect(parseNumber("180 kg")).toBe(180);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(7)).toBe(7);
  });
  it("parses dates", () => {
    expect(parseDate("12/12/2026")?.toISOString().slice(0, 10)).toBe("2026-12-12");
    expect(parseDate("2026-12-12 09:30")?.toISOString()).toBe("2026-12-12T08:30:00.000Z");
    expect(parseDate(46000)?.getUTCFullYear()).toBe(2025);
    expect(parseDate("mañana")).toBeNull();
  });
  it("flags per-row errors", () => {
    const rows = mapRows([{ N: "", S: "x" }, { N: "Cercha", S: "-3" }, { N: "Silla", S: "10" }], "inventario", { name: "N", stockTotal: "S" });
    expect(rows[0]!.errors).toEqual(expect.arrayContaining(["Nombre obligatorio", "Stock: «x» no es un número"]));
    expect(rows[1]!.errors).toEqual(["Stock negativo"]);
    expect(rows[2]!.errors).toEqual([]);
    expect(rows[2]!.values.stockTotal).toBe(10);
    const p = mapRows([{ a: "Boda", s: "10/12/2026", e: "08/12/2026" }], "proyectos", { name: "a", start: "s", end: "e" });
    expect(p[0]!.errors).toContain("El fin es anterior al inicio");
    const c = mapRows([{ n: "Ana", t: "Supplier", m: "no-mail" }], "contactos", { name: "n", kind: "t", email: "m" });
    expect(c[0]!.values.kind).toBe("proveedor");
    expect(c[0]!.errors).toContain("Correo no válido");
  });
  it("generates SKUs from names", () => {
    expect(skuFromName("Mesa redonda Ø180", 0)).toBe("MESA-REDONDA-180-001");
  });
});
