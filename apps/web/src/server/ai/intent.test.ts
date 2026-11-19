import { describe, expect, it } from "vitest";
import { zonedTime } from "@rentevent/core";
import { bestMatch, detectIntent, normalize, parseDateRange } from "./intent";

// Thursday 19 November 2026, 10:00 Madrid
const NOW = zonedTime(2026, 11, 19, 10, 0);

describe("parseDateRange", () => {
  it("single dates", () => {
    expect(parseDateRange("el 12 de diciembre", NOW)).toEqual({ from: "2026-12-12", to: "2026-12-12" });
    expect(parseDateRange("12 de diciembre de 2027", NOW)).toEqual({ from: "2027-12-12", to: "2027-12-12" });
    expect(parseDateRange("el 3 de enero", NOW)).toEqual({ from: "2027-01-03", to: "2027-01-03" });
    expect(parseDateRange("el 15 de noviembre", NOW)).toEqual({ from: "2026-11-15", to: "2026-11-15" });
    expect(parseDateRange("12/12", NOW)).toEqual({ from: "2026-12-12", to: "2026-12-12" });
    expect(parseDateRange("12/12/27", NOW)).toEqual({ from: "2027-12-12", to: "2027-12-12" });
    expect(parseDateRange("el 31 de febrero", NOW)).toBeNull();
  });
  it("ranges", () => {
    expect(parseDateRange("¿Qué carpa puedo montar del 12 al 15 de diciembre?", NOW)).toEqual({ from: "2026-12-12", to: "2026-12-15" });
    expect(parseDateRange("entre el 12 y el 15 de diciembre", NOW)).toEqual({ from: "2026-12-12", to: "2026-12-15" });
    expect(parseDateRange("12-15 de diciembre", NOW)).toEqual({ from: "2026-12-12", to: "2026-12-15" });
    expect(parseDateRange("del 28 de diciembre al 3 de enero", NOW)).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });
  it("relative expressions", () => {
    expect(parseDateRange("hoy", NOW)).toEqual({ from: "2026-11-19", to: "2026-11-19" });
    expect(parseDateRange("mañana", NOW)).toEqual({ from: "2026-11-20", to: "2026-11-20" });
    expect(parseDateRange("pasado mañana", NOW)).toEqual({ from: "2026-11-21", to: "2026-11-21" });
    expect(parseDateRange("el sábado", NOW)).toEqual({ from: "2026-11-21", to: "2026-11-21" });
    expect(parseDateRange("el jueves", NOW)).toEqual({ from: "2026-11-19", to: "2026-11-19" });
    expect(parseDateRange("¿Quién está libre el sábado 12 de diciembre?", NOW)).toEqual({ from: "2026-12-12", to: "2026-12-12" });
    expect(parseDateRange("esta semana", NOW)).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(parseDateRange("la semana que viene", NOW)).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(parseDateRange("este mes", NOW)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(parseDateRange("el mes que viene", NOW)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(parseDateRange("facturación de octubre", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(parseDateRange("hola", NOW)).toBeNull();
  });
});

describe("detectIntent", () => {
  it("max tent length", () => {
    expect(detectIntent("¿Qué carpa puedo montar del 12 al 15 de diciembre?", NOW)).toEqual({ kind: "largo_maximo", range: { from: "2026-12-12", to: "2026-12-15" }, anchoring: "anclaje" });
    expect(detectIntent("largo máximo con pesos el 12 de diciembre", NOW)).toMatchObject({ kind: "largo_maximo", anchoring: "pesos" });
  });
  it("free crew", () => {
    expect(detectIntent("¿Quién está libre el sábado 12 de diciembre?", NOW)).toEqual({ kind: "personal_libre", range: { from: "2026-12-12", to: "2026-12-12" } });
    expect(detectIntent("montadores disponibles mañana", NOW)).toMatchObject({ kind: "personal_libre" });
  });
  it("availability of an item", () => {
    expect(detectIntent("¿Cuántas cerchas de 10 m hay libres el 12 de diciembre?", NOW)).toMatchObject({ kind: "disponibilidad", item: "cerchas de 10 m" });
    expect(detectIntent("disponibilidad de sillas del 12 al 15 de diciembre", NOW)).toMatchObject({ kind: "disponibilidad", item: "sillas", range: { from: "2026-12-12", to: "2026-12-15" } });
  });
  it("orders, billing and help", () => {
    expect(detectIntent("pedidos de esta semana", NOW)).toMatchObject({ kind: "pedidos_periodo", range: { from: "2026-11-16" } });
    expect(detectIntent("¿Cuánto hemos facturado este mes?", NOW)).toMatchObject({ kind: "resumen_facturacion" });
    expect(detectIntent("hola", NOW)).toEqual({ kind: "ayuda" });
  });
  it("draft order", () => {
    const i = detectIntent("Crea un pedido de una carpa 10x20 para el 12 de diciembre para Hotel Playa Mayor", NOW);
    expect(i).toMatchObject({ kind: "crear_borrador", width: 10, length: 20, client: "hotel playa mayor", range: { from: "2026-12-12" } });
    expect(detectIntent("prepara un presupuesto de una 15x30 pata alta", NOW)).toMatchObject({ kind: "crear_borrador", width: 15, length: 30, height: "alta", client: null });
  });
});

describe("helpers", () => {
  it("normalize and fuzzy match", () => {
    expect(normalize("¿Quién ESTÁ libre?")).toBe("quien esta libre");
    const items = [{ name: "Cercha 10 m pata baja" }, { name: "Cercha 15 m pata alta" }, { name: "Silla plegable blanca" }];
    expect(bestMatch("cerchas de 10 m", items, (x) => x.name)?.name).toBe("Cercha 10 m pata baja");
    expect(bestMatch("sillas", items, (x) => x.name)?.name).toBe("Silla plegable blanca");
    expect(bestMatch("moqueta", items, (x) => x.name)).toBeNull();
    expect(bestMatch("silla", items, (x) => x.name)?.name).toBe("Silla plegable blanca");
    expect(bestMatch("", items, (x) => x.name)).toBeNull();
  });
});
