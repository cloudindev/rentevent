import { describe, expect, it } from "vitest";
import { termsBlocks } from "./terms";

describe("termsBlocks", () => {
  it("detects title, numbered headings and body text", () => {
    const b = termsBlocks("ALQUILER DE CARPAS · CONDICIONES GENERALES\n\n1. Validez, alcance y disponibilidad\nLa oferta tiene una validez de 7 días.\n\n10. Cancelación y compromiso de pago\nUna vez aceptado el presupuesto…");
    expect(b.map((x) => x.kind)).toEqual(["title", "heading", "text", "heading", "text"]);
  });
  it("keeps plain one-paragraph conditions as text", () => {
    expect(termsBlocks("Precios sin IVA. Validez de la oferta: 30 días.")).toEqual([{ kind: "text", text: "Precios sin IVA. Validez de la oferta: 30 días." }]);
  });
  it("doesn't treat a numbered sentence as a heading", () => {
    expect(termsBlocks("1. El cliente abonará el 50 % al reservar.")[0]!.kind).toBe("text");
  });
});
