"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ANCHORING_LABELS,
  BOM_GROUP_LABELS,
  BOM_GROUPS,
  computeBom,
  defaultConfiguration,
  LAYOUT_LABELS,
  validateFormula,
  VARIABLE_DOCS,
  variableNamesFor,
  type Anchoring,
  type BomGroup,
  type BomRule,
  type SeatingLayout,
  type VehicleType,
} from "@rentevent/core";
import type { CatalogFamily, CatalogItem } from "@/server/catalog";
import { duplicateFamily, deleteFamily, reactivateFamily, saveFamily, saveRules } from "@/server/actions/tents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/badge";
import { Switch } from "@/components/ui/menu";
import { cn, formatNumber } from "@/lib/utils";

type RuleDraft = { key: string; itemId: string; formula: string; condition: string; group: BomGroup; note: string };

const LABOR_LABELS: Record<string, string> = {
  minPorPortico: "Min. por pórtico",
  minPorLonaTecho: "Min. por lona de techo",
  minPorLateral: "Min. por lateral",
  minPorFrente: "Min. por frente",
  minPorM2Suelo: "Min. por m² de suelo",
  minPorPeso: "Min. por peso",
  factorDesmontaje: "Factor desmontaje",
  personasMinimas: "Personas mínimas",
};

export function FamilyEditor({ family, rules, items, vehicles, canEdit }: { family: CatalogFamily; rules: BomRule[]; items: CatalogItem[]; vehicles: VehicleType[]; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(family);
  const [params, setParams] = useState(Object.entries(family.parameters).map(([k, v]) => ({ k, v: String(v) })));
  const [drafts, setDrafts] = useState<RuleDraft[]>(rules.map((r) => ({ key: r.id, itemId: r.itemId, formula: r.formula, condition: r.condition ?? "", group: r.group, note: r.note ?? "" })));
  const [preview, setPreview] = useState({ modules: Math.min(family.maxModules, Math.max(family.minModules, 4)), anchoring: "anclaje" as Anchoring, layout: "ninguno" as SeatingLayout, tarima: false, transparentSides: 0 });
  const [pending, start] = useTransition();

  const parameters = useMemo(() => Object.fromEntries(params.filter((p) => p.k.trim()).map((p) => [p.k.trim(), Number(p.v) || 0])), [params]);
  const varNames = useMemo(() => variableNamesFor({ parameters }), [parameters]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);

  const validation = drafts.map((d) => ({ formula: validateFormula(d.formula || "0", varNames), condition: d.condition ? validateFormula(d.condition, varNames) : ({ ok: true } as const) }));
  const valid = validation.every((v) => v.formula.ok && v.condition.ok) && drafts.every((d) => d.itemId);

  const bom = useMemo(() => {
    const fam = { ...f, parameters };
    const cfg = defaultConfiguration(fam, preview.modules);
    cfg.anchoring = preview.anchoring;
    cfg.interior.layout = preview.layout;
    cfg.floors.tarima.enabled = preview.tarima;
    cfg.bays = cfg.bays.map((b, i) => (i < preview.transparentSides ? { ...b, left: "transparente", right: "transparente" } : b));
    const liveRules: BomRule[] = drafts.filter((d, i) => d.itemId && validation[i]!.formula.ok && validation[i]!.condition.ok).map((d, i) => ({ id: d.key, familyId: f.id, itemId: d.itemId, formula: d.formula, condition: d.condition || null, group: d.group, sortOrder: i, note: d.note || null }));
    return computeBom({ config: cfg, family: fam, rules: liveRules, items, vehicles });
  }, [f, parameters, preview, drafts, validation, items, vehicles]);

  const setRule = (i: number, patch: Partial<RuleDraft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const move = (i: number, dir: -1 | 1) =>
    setDrafts((ds) => {
      const j = i + dir;
      if (j < 0 || j >= ds.length) return ds;
      const copy = [...ds];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });

  const save = () =>
    start(async () => {
      const r1 = await saveFamily({ ...f, parameters, labor: f.labor });
      if (!r1.ok) { toast.error(r1.error); return; }
      const r2 = await saveRules({ familyId: f.id, rules: drafts.map((d) => ({ itemId: d.itemId, formula: d.formula, condition: d.condition || null, group: d.group, note: d.note || null })) });
      if (!r2.ok) { toast.error(r2.error); return; }
      toast.success("Familia y reglas guardadas");
      router.refresh();
    });

  const num = (k: keyof CatalogFamily) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: Number(e.target.value) }));

  return (
    <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Geometría y tarifa</CardTitle>
              <CardDescription>El largo se compone de módulos; pórticos = módulos + 1.</CardDescription>
            </div>
            <div className="flex gap-1.5">
              {!family.active && <StatusPill tone="neutral">Inactiva</StatusPill>}
              {f.parametersPending ? <StatusPill tone="warning">Pendiente validar</StatusPill> : <StatusPill tone="success">Validada</StatusPill>}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Código" htmlFor="code">
              <Input id="code" value={f.code} disabled={!canEdit} onChange={(e) => setF({ ...f, code: e.target.value })} />
            </Field>
            <Field label="Nombre" htmlFor="name" className="sm:col-span-1 lg:col-span-3">
              <Input id="name" value={f.name} disabled={!canEdit} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Ancho (luz) m" htmlFor="width">
              <Input id="width" type="number" step="0.5" value={f.width} disabled={!canEdit} onChange={num("width")} />
            </Field>
            <Field label="Módulo m" htmlFor="ml">
              <Input id="ml" type="number" step="0.5" value={f.moduleLength} disabled={!canEdit} onChange={num("moduleLength")} />
            </Field>
            <Field label="Altura alero m" htmlFor="eave">
              <Input id="eave" type="number" step="0.1" value={f.eaveHeight} disabled={!canEdit} onChange={num("eaveHeight")} />
            </Field>
            <Field label="Altura cumbrera m" htmlFor="ridge">
              <Input id="ridge" type="number" step="0.1" value={f.ridgeHeight} disabled={!canEdit} onChange={num("ridgeHeight")} />
            </Field>
            <Field label="Pata" htmlFor="hc">
              <NativeSelect id="hc" value={f.heightClass} disabled={!canEdit} onChange={(e) => setF({ ...f, heightClass: e.target.value as CatalogFamily["heightClass"] })}>
                <option value="baja">Baja</option>
                <option value="alta">Alta</option>
              </NativeSelect>
            </Field>
            <Field label="Cubierta" htmlFor="shape">
              <NativeSelect id="shape" value={f.roofShape} disabled={!canEdit} onChange={(e) => setF({ ...f, roofShape: e.target.value as CatalogFamily["roofShape"] })}>
                <option value="dos_aguas">Dos aguas</option>
                <option value="poligonal">Poligonal</option>
                <option value="jaima">Jaima</option>
              </NativeSelect>
            </Field>
            <Field label="Cercha (artículo físico)" htmlFor="truss" className="lg:col-span-2" hint="La disponibilidad se calcula sobre el artículo; varias familias pueden compartirlo.">
              <NativeSelect id="truss" value={f.trussItemId ?? ""} disabled={!canEdit} onChange={(e) => setF({ ...f, trussItemId: e.target.value || null })}>
                <option value="">Sin cercha</option>
                {items
                  .filter((i) => i.role === "cercha" || i.role === "jaima")
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sku} · {i.name} ({i.stockTotal} uds)
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field label="Módulos mín." htmlFor="min">
              <Input id="min" type="number" value={f.minModules} disabled={!canEdit} onChange={num("minModules")} />
            </Field>
            <Field label="Módulos máx." htmlFor="max">
              <Input id="max" type="number" value={f.maxModules} disabled={!canEdit} onChange={num("maxModules")} />
            </Field>
            <Field label="Tarifa" htmlFor="pm">
              <NativeSelect id="pm" value={f.priceMode} disabled={!canEdit} onChange={(e) => setF({ ...f, priceMode: e.target.value as "m2" | "ml" })}>
                <option value="m2">€ por m²</option>
                <option value="ml">€ por metro lineal</option>
              </NativeSelect>
            </Field>
            <Field label="Precio" htmlFor="price">
              <Input id="price" type="number" step="0.1" value={f.price} disabled={!canEdit} onChange={num("price")} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch checked={f.active} disabled={!canEdit} onCheckedChange={(v) => setF({ ...f, active: v })} /> Activa
            </label>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Datos del fabricante</CardTitle>
                <CardDescription>Variables propias de la familia que puedes usar en las fórmulas.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {params.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label="Variable" value={p.k} disabled={!canEdit} className="font-mono text-[13px]" onChange={(e) => setParams((ps) => ps.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
                  <Input aria-label="Valor" type="number" step="0.1" value={p.v} disabled={!canEdit} className="w-28" onChange={(e) => setParams((ps) => ps.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
                  {canEdit && (
                    <Button variant="ghost" size="icon" aria-label="Quitar variable" onClick={() => setParams((ps) => ps.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setParams((ps) => [...ps, { k: "nueva_variable", v: "0" }])}>
                  <Plus /> Añadir variable
                </Button>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Ratios de montaje</CardTitle>
                <CardDescription>Minutos-persona para estimar horas y turnos.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {Object.entries(f.labor).map(([k, v]) => (
                <Field key={k} label={LABOR_LABELS[k] ?? k} htmlFor={`lab-${k}`}>
                  <Input id={`lab-${k}`} type="number" step="0.1" value={v} disabled={!canEdit} onChange={(e) => setF({ ...f, labor: { ...f.labor, [k]: Number(e.target.value) } })} />
                </Field>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Reglas de despiece</CardTitle>
              <CardDescription>Cada regla: artículo, fórmula de cantidad y condición opcional. Se evalúan con un intérprete propio, sin código ejecutable.</CardDescription>
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setDrafts((d) => [...d, { key: `new-${Date.now()}`, itemId: "", formula: "porticos", condition: "", group: "estructura", note: "" }])}>
                <Plus /> Regla
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,2fr)_110px_minmax(0,1.4fr)_minmax(0,1.2fr)_84px] gap-2 px-1 text-xs text-muted-foreground md:grid">
              <span>Artículo</span>
              <span>Grupo</span>
              <span>Cantidad</span>
              <span>Condición</span>
              <span />
            </div>
            {drafts.map((d, i) => {
              const v = validation[i]!;
              return (
                <div key={d.key} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[minmax(0,2fr)_110px_minmax(0,1.4fr)_minmax(0,1.2fr)_84px] md:border-0 md:p-0">
                  <div className="space-y-1">
                    <NativeSelect aria-label="Artículo" value={d.itemId} disabled={!canEdit} onChange={(e) => setRule(i, { itemId: e.target.value })} aria-invalid={!d.itemId}>
                      <option value="">Elige artículo…</option>
                      {categories.map((c) => (
                        <optgroup key={c} label={c}>
                          {items
                            .filter((it) => it.category === c)
                            .map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </NativeSelect>
                    <Input aria-label="Nota" placeholder="Nota (opcional)" maxLength={200} value={d.note} disabled={!canEdit} className="h-7 text-xs" onChange={(e) => setRule(i, { note: e.target.value })} />
                  </div>
                  <NativeSelect aria-label="Grupo" value={d.group} disabled={!canEdit} onChange={(e) => setRule(i, { group: e.target.value as BomGroup })}>
                    {BOM_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {BOM_GROUP_LABELS[g]}
                      </option>
                    ))}
                  </NativeSelect>
                  <div>
                    <Input aria-label="Fórmula" value={d.formula} disabled={!canEdit} className="font-mono text-[13px]" aria-invalid={!v.formula.ok} onChange={(e) => setRule(i, { formula: e.target.value })} />
                    {!v.formula.ok && <p className="mt-1 text-xs text-danger">{v.formula.error}</p>}
                  </div>
                  <div>
                    <Input aria-label="Condición" placeholder="siempre" value={d.condition} disabled={!canEdit} className="font-mono text-[13px]" aria-invalid={!v.condition.ok} onChange={(e) => setRule(i, { condition: e.target.value })} />
                    {!v.condition.ok && "error" in v.condition && <p className="mt-1 text-xs text-danger">{v.condition.error}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex">
                      <Button variant="ghost" size="icon-sm" aria-label="Subir" onClick={() => move(i, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Bajar" onClick={() => move(i, 1)}>
                        <ArrowDown />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Eliminar regla" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            <details className="pt-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Variables y funciones disponibles</summary>
              <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {[...VARIABLE_DOCS, ...Object.keys(parameters).map((k) => ({ name: k, description: "Dato del fabricante" }))].map((v) => (
                  <p key={v.name}>
                    <code className="rounded bg-muted px-1 text-[12px]">{v.name}</code> <span className="text-muted-foreground">{v.description}</span>
                  </p>
                ))}
                <p className="sm:col-span-2 text-muted-foreground">
                  Funciones: <code>si(c, a, b)</code>, <code>min</code>, <code>max</code>, <code>techo</code>, <code>suelo</code>, <code>redondear</code>, <code>abs</code>. Operadores: <code>+ - * / % ^</code>, <code>= != &lt; &gt;</code>, <code>y o no</code>.
                </p>
              </div>
            </details>
          </CardContent>
        </Card>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={pending || !valid}>
              {pending ? "Guardando…" : "Guardar familia y reglas"}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                start(async () => {
                  const r = await duplicateFamily({ id: f.id });
                  if (r.ok) router.push(`/app/carpas/${r.data.id}`);
                  else toast.error(r.error);
                })
              }
            >
              <Copy /> Duplicar
            </Button>
            {family.active ? (
              <Button
                variant="ghost"
                className="text-danger"
                disabled={pending}
                onClick={() =>
                  confirm("¿Desactivar esta familia? Deja de ofrecerse en pedidos nuevos; los pedidos existentes no cambian.") &&
                  start(async () => {
                    const r = await deleteFamily({ id: f.id });
                    if (!r.ok) { toast.error(r.error); return; }
                    toast.success("Familia desactivada");
                    router.push("/app/carpas");
                  })
                }
              >
                Desactivar
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await reactivateFamily({ id: f.id });
                    if (!r.ok) { toast.error(r.error); return; }
                    setF((x) => ({ ...x, active: true }));
                    toast.success("Familia reactivada");
                    router.refresh();
                  })
                }
              >
                Reactivar
              </Button>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Vista previa del despiece</CardTitle>
              <CardDescription>Se recalcula al instante con las reglas sin guardar.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Largo: ${preview.modules * f.moduleLength} m`} htmlFor="pv-mod">
                <input id="pv-mod" type="range" min={f.minModules} max={f.maxModules} value={preview.modules} onChange={(e) => setPreview({ ...preview, modules: Number(e.target.value) })} className="accent-[var(--brand)]" />
              </Field>
              <Field label="Fijación" htmlFor="pv-anch">
                <NativeSelect id="pv-anch" value={preview.anchoring} onChange={(e) => setPreview({ ...preview, anchoring: e.target.value as Anchoring })}>
                  {Object.entries(ANCHORING_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Interior" htmlFor="pv-lay">
                <NativeSelect id="pv-lay" value={preview.layout} onChange={(e) => setPreview({ ...preview, layout: e.target.value as SeatingLayout })}>
                  {Object.entries(LAYOUT_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Tramos transparentes" htmlFor="pv-tr">
                <Input id="pv-tr" type="number" min={0} max={preview.modules} value={preview.transparentSides} onChange={(e) => setPreview({ ...preview, transparentSides: Number(e.target.value) })} />
              </Field>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <Switch checked={preview.tarima} onCheckedChange={(v) => setPreview({ ...preview, tarima: v })} /> Con tarima
              </label>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Medidas", `${bom.metrics.ancho}x${bom.metrics.largo}`],
                ["Superficie", `${formatNumber(bom.metrics.superficie)} m²`],
                ["Peso", `${formatNumber(bom.totals.weightKg / 1000)} t`],
                ["Volumen", `${formatNumber(bom.totals.volumeM3)} m³`],
                ["Montaje", `${bom.labor.montajeHoras} h·p`],
                ["Aforo cóctel", formatNumber(bom.metrics.aforo.coctel)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-subtle p-2">
                  <dt className="text-[11px] text-muted-foreground">{k}</dt>
                  <dd className="tabular text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {bom.errors.length > 0 && <p className="rounded-lg bg-danger-bg p-2 text-xs text-danger">{bom.errors.length} regla(s) con error</p>}
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {bom.lines.map((l) => {
                    const it = itemById.get(l.itemId);
                    return (
                      <tr key={l.itemId} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{it?.name ?? "?"}</td>
                        <td className={cn("tabular px-3 py-1.5 text-right font-medium", it && l.quantity > it.stockTotal - it.stockRepair && "text-danger")}>
                          {formatNumber(l.quantity)} {it?.unit === "m2" ? "m²" : ""}
                        </td>
                      </tr>
                    );
                  })}
                  {bom.lines.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-muted-foreground">Sin líneas: añade reglas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {bom.vehicles[0] && (
              <p className="text-xs text-muted-foreground">
                Transporte: {bom.vehicles.map((v) => `${v.count} × ${v.name}`).join(" o ")}
              </p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
