"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Entity = "inventario" | "contactos" | "proyectos";
type FieldDef = { key: string; label: string; required?: boolean };
type Preview = { headers: string[]; mapping: Record<string, string | null>; fields: FieldDef[]; total: number; invalid: number; sample: { row: number; values: Record<string, unknown>; errors: string[] }[]; errors: { row: number; errors: string[] }[] };
type Result = { mode: string; total: number; created: number; updated: number; skipped: number; errors: { row: number; message: string }[] };

const ENTITIES: { id: Entity; label: string; hint: string }[] = [
  { id: "inventario", label: "Inventario", hint: "Artículos con stock, peso y tarifa. Se actualizan por SKU." },
  { id: "contactos", label: "Clientes y proveedores", hint: "Se actualizan por NIF o, si no hay, por nombre." },
  { id: "proyectos", label: "Proyectos", hint: "Se crean como consulta con un pedido en borrador." },
];

const show = (v: unknown) => (v == null ? "—" : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString("es-ES") : String(v));

export function Importer({ allowed, onDone, compact }: { allowed: Record<Entity, boolean>; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [entity, setEntity] = useState<Entity>((Object.keys(allowed) as Entity[]).find((k) => allowed[k]) ?? "inventario");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  async function call(mode: "preview" | "dryrun" | "import", f = file, m: Record<string, string | null> | null = mapping, ent: Entity = entity) {
    if (!f) return;
    const id = ++seq.current;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("entity", ent);
    fd.append("mode", mode);
    if (m && mode !== "preview") fd.append("mapping", JSON.stringify(m));
    if (m && mode === "preview" && Object.keys(m).length) fd.append("mapping", JSON.stringify(m));
    const res = await fetch("/app/configuracion/importar/api", { method: "POST", body: fd });
    const j = await res.json();
    if (id !== seq.current) return; // a newer request (other file or type) superseded this one
    setBusy(false);
    if (!res.ok) {
      toast.error(j.error ?? "Error al importar");
      return;
    }
    if (mode === "preview") {
      setPreview(j);
      setMapping(j.mapping);
      setResult(null);
    } else {
      setResult(j);
      if (mode === "import") {
        toast.success(`Importación completada: ${j.created} nuevos, ${j.updated} actualizados`);
        router.refresh();
        onDone?.();
      }
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Importar desde CSV o Excel</CardTitle>
            <CardDescription>Acepta exportaciones de Rentman y de hojas de cálculo propias. Revisarás el resultado antes de guardar nada.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("grid gap-2", !compact && "sm:grid-cols-3")}>
            {ENTITIES.filter((e) => allowed[e.id]).map((e) => (
              <button key={e.id} type="button" onClick={() => {
                if (e.id === entity) return;
                setEntity(e.id);
                setPreview(null);
                setResult(null);
                setMapping({});
                // keep the chosen file: re-read it for the new type instead of making the user pick it again
                if (file) void call("preview", file, null, e.id);
              }} className={cn("rounded-xl border p-3 text-left text-sm hover:bg-subtle", entity === e.id && "border-brand-400 bg-brand-50 dark:bg-brand-950")}>
                <span className="block font-medium">{e.label}</span>
                <span className="block text-xs text-muted-foreground">{e.hint}</span>
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center hover:bg-subtle">
            <FileSpreadsheet className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">{file ? file.name : "Elige un archivo .csv o .xlsx"}</span>
            <span className="text-xs text-muted-foreground">Máximo 10 MB y 5.000 filas · separador , o ;</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                // clear the input so picking the same file again still fires onChange
                e.target.value = "";
                setFile(f);
                setMapping({});
                setPreview(null);
                setResult(null);
                if (f) void call("preview", f, null);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Columnas</CardTitle>
              <CardDescription>
                {preview.total} filas · {preview.invalid > 0 ? <span className="text-danger">{preview.invalid} con errores (se omitirán)</span> : "sin errores"}
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => call("preview")}>Revalidar</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {preview.fields.map((f) => (
                <label key={f.key} className="grid gap-1 text-sm">
                  <span className="text-[13px] font-medium">{f.label}{f.required && <span className="text-danger"> *</span>}</span>
                  <NativeSelect value={mapping[f.key] ?? ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || null })}>
                    <option value="">— No importar —</option>
                    {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </NativeSelect>
                </label>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-subtle">
                  <tr>
                    <th className="px-3 py-2 text-left font-normal text-muted-foreground">Fila</th>
                    {preview.fields.map((f) => <th key={f.key} className="px-3 py-2 text-left font-normal text-muted-foreground">{f.label}</th>)}
                    <th className="px-3 py-2 text-left font-normal text-muted-foreground">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={r.row} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">{r.row}</td>
                      {preview.fields.map((f) => <td key={f.key} className="max-w-48 truncate px-3 py-1.5">{show(r.values[f.key])}</td>)}
                      <td className="px-3 py-1.5">{r.errors.length ? <StatusPill tone="danger">{r.errors[0]}</StatusPill> : <StatusPill tone="success">OK</StatusPill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.errors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-danger">Ver filas con errores ({preview.invalid})</summary>
                <ul className="mt-2 space-y-0.5 text-xs">{preview.errors.map((e) => <li key={e.row}>Fila {e.row}: {e.errors.join("; ")}</li>)}</ul>
              </details>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => call("dryrun")}>Simular</Button>
              <Button disabled={busy} onClick={() => call("import")}><Upload /> Importar {preview.total - preview.invalid} filas</Button>
            </div>
            {result && (
              <p className={cn("rounded-lg px-3 py-2 text-sm", result.mode === "import" ? "bg-success-bg text-success" : "bg-info-bg text-info")} role="status">
                {result.mode === "import" ? "Importado" : "Simulación"}: {result.created} nuevos · {result.updated} actualizados · {result.skipped} omitidos
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
