/**
 * Splits free-text quote conditions into blocks so the PDF and the public
 * quote page can style them: numbered lines ("1. Reserva y pago") become
 * headings, a short all-caps line becomes the title, the rest is body text.
 */
export type TermsBlock = { kind: "title" | "heading" | "text"; text: string };

export function termsBlocks(terms: string): TermsBlock[] {
  return terms
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): TermsBlock => {
      if (line.length <= 90 && /^\d{1,2}[.)]\s+\S/.test(line) && !/[.:;]$/.test(line)) return { kind: "heading", text: line };
      if (line.length <= 90 && /\p{L}/u.test(line) && line === line.toLocaleUpperCase("es")) return { kind: "title", text: line };
      return { kind: "text", text: line };
    });
}
