/**
 * Column mapping for CSV/Excel imports (pure, testable).
 * Recognises Spanish headers and the Rentman export headers.
 */
export type ImportEntity = "inventario" | "contactos" | "proyectos";

export type FieldDef = { key: string; label: string; required?: boolean; type: "text" | "number" | "date" | "enum"; aliases: string[]; options?: string[] };

export const FIELDS: Record<ImportEntity, FieldDef[]> = {
  inventario: [
    { key: "sku", label: "SKU / código", type: "text", aliases: ["sku", "codigo", "code", "number", "numero", "referencia", "ref", "item number", "barcode"] },
    { key: "name", label: "Nombre", required: true, type: "text", aliases: ["name", "nombre", "articulo", "descripcion", "description", "item"] },
    { key: "category", label: "Categoría", type: "text", aliases: ["category", "categoria", "folder", "carpeta", "grupo", "group", "type"] },
    { key: "stockTotal", label: "Stock", type: "number", aliases: ["stock", "current stock", "quantity", "cantidad", "qty", "existencias", "stock total", "amount in stock"] },
    { key: "weightKg", label: "Peso (kg)", type: "number", aliases: ["weight", "peso", "peso kg", "weight (kg)"] },
    { key: "volumeM3", label: "Volumen (m³)", type: "number", aliases: ["volume", "volumen", "volume (m3)"] },
    { key: "price", label: "Tarifa", type: "number", aliases: ["price", "precio", "rental price", "tarifa", "precio alquiler", "rental"] },
    { key: "costPrice", label: "Coste", type: "number", aliases: ["cost", "coste", "purchase price", "precio compra"] },
    { key: "unit", label: "Unidad", type: "enum", options: ["ud", "m2", "m", "ml", "rollo", "kg"], aliases: ["unit", "unidad", "unidades"] },
    { key: "location", label: "Ubicación", type: "text", aliases: ["location", "ubicacion", "estante", "shelf", "warehouse location"] },
  ],
  contactos: [
    { key: "name", label: "Nombre", required: true, type: "text", aliases: ["name", "nombre", "company", "empresa", "displayname", "razon social"] },
    { key: "kind", label: "Tipo", type: "enum", options: ["cliente", "proveedor", "localizacion"], aliases: ["type", "tipo", "kind"] },
    { key: "taxId", label: "NIF / CIF", type: "text", aliases: ["vat number", "vat", "nif", "cif", "tax id", "tax number", "dni", "coc number"] },
    { key: "email", label: "Correo", type: "text", aliases: ["email", "e-mail", "correo", "mail"] },
    { key: "phone", label: "Teléfono", type: "text", aliases: ["phone", "telefono", "tel", "mobile", "movil", "phone number"] },
    { key: "street", label: "Dirección", type: "text", aliases: ["street", "direccion", "address", "calle", "visit street", "invoice street"] },
    { key: "city", label: "Población", type: "text", aliases: ["city", "ciudad", "poblacion", "localidad", "visit city", "invoice city"] },
    { key: "postalCode", label: "Código postal", type: "text", aliases: ["postal code", "postalcode", "zip", "codigo postal", "cp", "visit postal code"] },
    { key: "province", label: "Provincia", type: "text", aliases: ["province", "provincia", "state", "region"] },
  ],
  proyectos: [
    { key: "name", label: "Nombre", required: true, type: "text", aliases: ["name", "nombre", "project", "proyecto", "event", "evento"] },
    { key: "number", label: "Número", type: "text", aliases: ["number", "numero", "code", "codigo", "project number", "ref"] },
    { key: "start", label: "Inicio", required: true, type: "date", aliases: ["start", "inicio", "start date", "fecha inicio", "planperiod start", "usageperiod start", "desde"] },
    { key: "end", label: "Fin", required: true, type: "date", aliases: ["end", "fin", "end date", "fecha fin", "planperiod end", "usageperiod end", "hasta"] },
    { key: "customer", label: "Cliente", type: "text", aliases: ["customer", "cliente", "client", "contact", "contacto"] },
    { key: "location", label: "Lugar", type: "text", aliases: ["location", "lugar", "venue", "ubicacion", "address"] },
  ],
};

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-z0-9() ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Maps each field to the best header (exact alias first, then contains). */
export function autoMap(headers: string[], entity: ImportEntity): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const used = new Set<string>();
  const nh = headers.map((h) => ({ h, n: norm(h) }));
  for (const f of FIELDS[entity]) {
    const aliases = f.aliases.map(norm);
    let hit = nh.find((x) => !used.has(x.h) && aliases.includes(x.n));
    if (!hit) hit = nh.find((x) => !used.has(x.h) && aliases.some((a) => a.length > 2 && (x.n.startsWith(`${a} `) || x.n.endsWith(` ${a}`))));
    out[f.key] = hit?.h ?? null;
    if (hit) used.add(hit.h);
  }
  return out;
}

/** "1.234,5" / "1,234.5" / "12,5" / "12.5 €" → number */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).replace(/[€\s]/g, "").replace(/kg|m3|m²|m2/gi, "");
  if (s === "") return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** dd/mm/yyyy[ hh:mm], yyyy-mm-dd[Thh:mm], Date or Excel serial → Date */
export function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
  if (v == null) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const y = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 8) - 1, Number(m[5] ?? 0)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 8) - 1, Number(m[5] ?? 0)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export type MappedRow = { index: number; values: Record<string, string | number | Date | null>; errors: string[] };

export function mapRows(rows: Record<string, unknown>[], entity: ImportEntity, mapping: Record<string, string | null>): MappedRow[] {
  return rows.map((raw, index) => {
    const values: MappedRow["values"] = {};
    const errors: string[] = [];
    for (const f of FIELDS[entity]) {
      const col = mapping[f.key];
      const v = col ? raw[col] : undefined;
      const empty = v == null || String(v).trim() === "";
      if (empty) {
        values[f.key] = null;
        if (f.required) errors.push(`${f.label} obligatorio`);
        continue;
      }
      if (f.type === "number") {
        const n = parseNumber(v);
        if (n == null) errors.push(`${f.label}: «${String(v)}» no es un número`);
        else if (n < 0) errors.push(`${f.label} negativo`);
        values[f.key] = n;
      } else if (f.type === "date") {
        const d = parseDate(v);
        if (!d) errors.push(`${f.label}: fecha no válida «${String(v)}»`);
        values[f.key] = d;
      } else if (f.type === "enum") {
        const n = norm(String(v));
        const opt = f.options!.find((o) => norm(o) === n) ?? (entity === "contactos" ? ({ customer: "cliente", client: "cliente", supplier: "proveedor", proveedor: "proveedor", location: "localizacion" } as Record<string, string>)[n] : n === "m2" || n === "m²" ? "m2" : undefined);
        values[f.key] = opt ?? null;
        if (!opt) errors.push(`${f.label}: valor «${String(v)}» no reconocido`);
      } else values[f.key] = String(v).trim().slice(0, 200);
    }
    if (entity === "proyectos" && values.start instanceof Date && values.end instanceof Date && values.end < values.start) errors.push("El fin es anterior al inicio");
    if (entity === "contactos" && typeof values.email === "string" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) errors.push("Correo no válido");
    return { index, values, errors };
  });
}

export function skuFromName(name: string, i: number) {
  const base = norm(name).replace(/[^a-z0-9]+/g, "-").toUpperCase().slice(0, 18);
  return `${base || "ART"}-${String(i + 1).padStart(3, "0")}`;
}
