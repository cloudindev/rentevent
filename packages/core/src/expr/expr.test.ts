import { describe, expect, it } from "vitest";
import { collectVariables, evaluate, evaluateBoolean, evaluateNumber, FormulaError, parse, tokenize, validateFormula } from ".";

describe("expression language", () => {
  const scope = { modulos: 4, porticos: 5, fijacion: "pesos", pesos_por_pata: 2, "laterales.blanco": 6, pata_alta: true };

  it("evaluates arithmetic with precedence", () => {
    expect(evaluateNumber("porticos * 2 * pesos_por_pata", scope)).toBe(20);
    expect(evaluateNumber("1 + 2 * 3", {})).toBe(7);
    expect(evaluateNumber("(1 + 2) * 3", {})).toBe(9);
    expect(evaluateNumber("2 ^ 3 ^ 2", {})).toBe(512);
    expect(evaluateNumber("-2 ^ 2", {})).toBe(-4);
    expect(evaluateNumber("+3 - -2", {})).toBe(5);
    expect(evaluateNumber("10 % 4", {})).toBe(2);
    expect(evaluateNumber(".5 * 4", {})).toBe(2);
  });

  it("treats division by zero as zero", () => {
    expect(evaluateNumber("5 / 0", {})).toBe(0);
    expect(evaluateNumber("5 % 0", {})).toBe(0);
  });

  it("supports dotted variables and booleans", () => {
    expect(evaluateNumber("laterales.blanco + 1", scope)).toBe(7);
    expect(evaluateNumber("pata_alta * 3", scope)).toBe(3);
    expect(evaluate("verdadero", {})).toBe(true);
    expect(evaluate("falso o true", {})).toBe(true);
  });

  it("compares strings and numbers", () => {
    expect(evaluateBoolean("fijacion = 'pesos'", scope)).toBe(true);
    expect(evaluateBoolean("fijacion == \"anclaje\"", scope)).toBe(false);
    expect(evaluateBoolean("fijacion <> 'anclaje'", scope)).toBe(true);
    expect(evaluateBoolean("fijacion != 'pesos'", scope)).toBe(false);
    expect(evaluateBoolean("modulos >= 4 y modulos < 5", scope)).toBe(true);
    expect(evaluateBoolean("modulos > 4 or modulos <= 3", scope)).toBe(false);
    expect(evaluateBoolean("no (modulos = 4)", scope)).toBe(false);
    expect(evaluateBoolean("!(modulos != 4) && 1", scope)).toBe(true);
    expect(evaluateBoolean("modulos == 4 || 0", scope)).toBe(true);
    expect(evaluateBoolean("2 != 3", {})).toBe(true);
    expect(evaluateBoolean("''", {})).toBe(false);
  });

  it("supports functions and conditionals", () => {
    expect(evaluateNumber("si(fijacion = 'pesos', porticos * 2, 0)", scope)).toBe(10);
    expect(evaluateNumber("if(0, 1, 2)", {})).toBe(2);
    expect(evaluateNumber("modulos > 3 ? 1 : 2", scope)).toBe(1);
    expect(evaluateNumber("modulos > 9 ? 1 : 2", scope)).toBe(2);
    expect(evaluateNumber("max(1, techo(modulos / 3)) * 4", scope)).toBe(8);
    expect(evaluateNumber("min(3, 1, 2) + abs(-2) + redondear(2.5) + round(1.4) + ceil(1.1) + suelo(1.9) + floor(2.9)", {})).toBe(1 + 2 + 3 + 1 + 2 + 1 + 2);
  });

  it("empty or blank conditions are true", () => {
    expect(evaluateBoolean(null, {})).toBe(true);
    expect(evaluateBoolean("  ", {})).toBe(true);
  });

  it("rejects unsafe or malformed input", () => {
    expect(() => parse("process.exit()")).not.toThrow();
    expect(() => evaluate("process.exit()", {})).toThrow(FormulaError);
    expect(() => parse("constructor['x']")).toThrow(FormulaError);
    expect(() => parse("a; b")).toThrow(/no permitido/);
    expect(() => parse("1 +")).toThrow(/incompleta/);
    expect(() => parse("")).toThrow(/vacía/);
    expect(() => parse("(1 + 2")).toThrow(/Se esperaba/);
    expect(() => parse("1 2")).toThrow(/Sobra/);
    expect(() => parse("'abc")).toThrow(/sin cerrar/);
    expect(() => tokenize("1.2.3")).toThrow(/Número/);
    expect(() => parse("x".repeat(501))).toThrow(/supera/);
    expect(() => parse("(".repeat(60) + "1" + ")".repeat(60))).toThrow(/anidada/);
    expect(() => parse(")")).toThrow(/no válida/);
    expect(() => evaluate("desconocida + 1", {})).toThrow(/Variable desconocida/);
    expect(() => evaluate("hack(1)", {})).toThrow(/Función desconocida/);
    expect(() => evaluate("si(1, 2)", {})).toThrow(/3 argumentos/);
    expect(() => evaluate("abs(1, 2)", {})).toThrow(/argumentos/);
    expect(() => evaluateNumber("'texto'", {})).toThrow(/número/);
  });

  it("does not leak prototype properties", () => {
    expect(() => evaluate("toString", {})).toThrow(/Variable desconocida/);
    expect(() => evaluate("__proto__", {})).toThrow(/Variable desconocida/);
  });

  it("validates formulas for the rule editor", () => {
    expect(validateFormula("porticos * 2", ["porticos"])).toEqual({ ok: true, variables: ["porticos"] });
    const bad = validateFormula("porticoz * 2", ["porticos"]);
    expect(bad.ok).toBe(false);
    expect(validateFormula("1 +", [])).toMatchObject({ ok: false });
    expect(validateFormula("foo(1)", [])).toMatchObject({ ok: false, error: expect.stringContaining("foo") });
    expect(validateFormula("max(-a, si(a, !a, a ? 1 : 2))", ["a"]).ok).toBe(true);
    expect([...collectVariables(parse("si(a, b, -c) + (d ? e : f)"))].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("caches compiled formulas safely", () => {
    for (let i = 0; i < 2100; i++) evaluateNumber(`${i} + 1`, {});
    expect(evaluateNumber("1 + 1", {})).toBe(2);
  });
});
