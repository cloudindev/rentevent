import "server-only";
import Papa from "papaparse";

export type ParsedSheet = { headers: string[]; rows: Record<string, unknown>[] };

export const MAX_IMPORT_ROWS = 5000;

/** Reads a CSV (`,` or `;`, UTF-8 or Latin-1) or the first sheet of an .xlsx. */
export async function parseImportFile(buffer: Buffer, filename: string): Promise<ParsedSheet> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (c, col) => {
      headers[col - 1] = String(c.text ?? c.value ?? "").trim() || `Columna ${col}`;
    });
    const rows: Record<string, unknown>[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1 || rows.length >= MAX_IMPORT_ROWS) return;
      const r: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (!h) return;
        const cell = row.getCell(i + 1);
        const v = cell.value;
        r[h] = v instanceof Date ? v : v && typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v && typeof v === "object" && "text" in v ? (v as { text: unknown }).text : v;
      });
      if (Object.values(r).some((x) => x != null && String(x).trim() !== "")) rows.push(r);
    });
    return { headers: headers.filter(Boolean), rows };
  }
  if (lower.endsWith(".xls")) throw new Error("El formato .xls antiguo no está soportado: guárdalo como .xlsx o CSV.");
  let text = buffer.toString("utf8");
  if (text.includes("�")) text = buffer.toString("latin1");
  text = text.replace(/^﻿/, "");
  const res = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy", delimitersToGuess: [";", ",", "\t", "|"], transformHeader: (h) => h.trim() });
  return { headers: (res.meta.fields ?? []).filter(Boolean), rows: res.data.slice(0, MAX_IMPORT_ROWS) };
}
