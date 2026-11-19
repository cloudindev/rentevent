import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { parseImportFile } from "@/server/importers/parse";
import { autoMap, FIELDS, mapRows, type ImportEntity } from "@/server/importers/mapping";
import { runImport } from "@/server/importers/run";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Stateless import endpoint (multipart): mode=preview → headers, mapping and
 * validated sample; mode=dryrun → counts without writing; mode=import → writes
 * everything in one transaction (all-or-nothing).
 */
export async function POST(req: Request) {
  const ctx = await getAppContext();
  if (!ctx) return Response.json({ error: "Sesión caducada" }, { status: 401 });
  const form = await req.formData();
  const entity = String(form.get("entity")) as ImportEntity;
  const mode = String(form.get("mode") ?? "preview");
  if (!(entity in FIELDS)) return Response.json({ error: "Tipo de importación no válido" }, { status: 400 });
  const perm = entity === "inventario" ? "inventario" : "comercial";
  if (!can(ctx.role, perm)) return Response.json({ error: "No tienes permiso para importar estos datos" }, { status: 403 });
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Adjunta un archivo CSV o Excel" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "El archivo supera 10 MB" }, { status: 413 });
  let sheet;
  try {
    sheet = await parseImportFile(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "No se pudo leer el archivo" }, { status: 400 });
  }
  if (sheet.headers.length === 0) return Response.json({ error: "El archivo no tiene cabeceras" }, { status: 400 });
  const custom = form.get("mapping") ? (JSON.parse(String(form.get("mapping"))) as Record<string, string | null>) : null;
  const mapping = custom ?? autoMap(sheet.headers, entity);
  const rows = mapRows(sheet.rows, entity, mapping);
  const invalid = rows.filter((r) => r.errors.length).length;
  if (mode === "preview") {
    return Response.json({ headers: sheet.headers, mapping, fields: FIELDS[entity], total: rows.length, invalid, sample: rows.slice(0, 20).map((r) => ({ row: r.index + 2, values: r.values, errors: r.errors })), errors: rows.filter((r) => r.errors.length).slice(0, 50).map((r) => ({ row: r.index + 2, errors: r.errors })) });
  }
  try {
    const result = await withTenant(ctx.tenantId, (tx) => runImport(tx, ctx, entity, rows, { dryRun: mode !== "import" }));
    return Response.json({ mode, total: rows.length, ...result });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "La importación ha fallado y no se ha guardado nada. Revisa los datos." }, { status: 500 });
  }
}
