import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateConditions, renderTemplate } from "./logic";

const vars = { total: 6200.5, cliente: "Ayuntamiento de Valdecastro", dias_para_retorno: 1, estado: "confirmado" };

describe("workflow conditions", () => {
  it("compares numbers and text", () => {
    expect(evaluateCondition({ field: "total", op: ">", value: 5000 }, vars)).toBe(true);
    expect(evaluateCondition({ field: "total", op: "<=", value: "6200,5" }, vars)).toBe(true);
    expect(evaluateCondition({ field: "total", op: "<", value: 100 }, vars)).toBe(false);
    expect(evaluateCondition({ field: "total", op: ">=", value: 7000 }, vars)).toBe(false);
    expect(evaluateCondition({ field: "dias_para_retorno", op: "=", value: "1" }, vars)).toBe(true);
    expect(evaluateCondition({ field: "estado", op: "!=", value: "opcion" }, vars)).toBe(true);
    expect(evaluateCondition({ field: "cliente", op: "contiene", value: "valdecastro" }, vars)).toBe(true);
    expect(evaluateCondition({ field: "cliente", op: "=", value: "AYUNTAMIENTO DE VALDECASTRO" }, vars)).toBe(true);
    expect(evaluateCondition({ field: "cliente", op: ">", value: "a" }, vars)).toBe(false);
    expect(evaluateCondition({ field: "noexiste", op: "=", value: 1 }, vars)).toBe(false);
    expect(evaluateConditions([], vars)).toBe(true);
    expect(evaluateConditions([{ field: "total", op: ">", value: 5000 }, { field: "estado", op: "=", value: "opcion" }], vars)).toBe(false);
  });
  it("renders templates", () => {
    expect(renderTemplate("Hola {{cliente}}, total {{ total }} {{desconocida}}", vars)).toBe("Hola Ayuntamiento de Valdecastro, total 6200.5 ");
  });
});
