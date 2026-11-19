import { createHash } from "node:crypto";
import { verifactuDate } from "./calc";


/**
 * Verifactu-style chained fingerprint (SHA-256, uppercase hex) over the
 * issuer tax id, invoice number, issue date, total and the previous record's
 * fingerprint. Changing any issued invoice breaks every later hash.
 */
export function verifactuHash(input: { taxId: string; fullNumber: string; issueDate: string; total: number; previousHash: string | null }): string {
  const payload = [
    `IDEmisorFactura=${input.taxId.trim().toUpperCase()}`,
    `NumSerieFactura=${input.fullNumber}`,
    `FechaExpedicionFactura=${verifactuDate(input.issueDate)}`,
    `TipoFactura=F1`,
    `ImporteTotal=${input.total.toFixed(2)}`,
    `Huella=${input.previousHash ?? ""}`,
  ].join("&");
  return createHash("sha256").update(payload, "utf8").digest("hex").toUpperCase();
}

export function verifyChain(records: { taxId: string; fullNumber: string; issueDate: string; total: number; previousHash: string | null; recordHash: string | null }[]): { ok: boolean; brokenAt: string | null } {
  let prev: string | null = null;
  for (const r of records) {
    if (r.previousHash !== prev) return { ok: false, brokenAt: r.fullNumber };
    if (verifactuHash({ ...r, previousHash: prev }) !== r.recordHash) return { ok: false, brokenAt: r.fullNumber };
    prev = r.recordHash;
  }
  return { ok: true, brokenAt: null };
}

