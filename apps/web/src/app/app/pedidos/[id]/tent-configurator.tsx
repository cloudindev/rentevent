"use client";
import { useMemo, useState, useTransition } from "react";
import { Box, Download, Layers, Minus, Plus, Save, Search, Split, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  ANCHORING_LABELS,
  computeAvailability,
  defaultConfiguration,
  FRONT_LABELS,
  LAYOUT_LABELS,
  resizeConfiguration,
  ROOF_LABELS,
  SIDE_LABELS,
  suggestAlternatives,
  transferConfiguration,
  type Alternative,
  type Anchoring,
  type FrontMaterial,
  type FrontType,
  type LineCheck,
  type ReservationInput,
  type RoofType,
  type SeatingLayout,
  type SideType,
  type StockInput,
  type SubrentalInput,
  type TentConfiguration,
} from "@rentevent/core";
import { TentPlan, TentViewer, type TentViewerApi } from "@/components/tent3d";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { StatusPill } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { newKey, type Catalogue, type TentLine, type WorkLine } from "@/lib/order-model";
import type { OrderWorkspaceData } from "@/server/orders";
import { createSubrentalForShortage, dateAlternatives, saveAsTemplate } from "@/server/actions/orders";

type Avail = { stocks: StockInput[]; reservations: ReservationInput[]; subrentals: SubrentalInput[] };

export function TentConfigurator({
  line,
  catalogue,
  checks,
  stocks,
  availability,
  order,
  marginMinutes,
  editable,
  onChange,
  onReplace,
  allLines,
  apiRef,
}: {
  line: TentLine;
  catalogue: Catalogue;
  checks: Map<string, LineCheck>;
  stocks: Map<string, StockInput>;
  availability: Avail;
  order: OrderWorkspaceData["order"];
  marginMinutes: number;
  editable: boolean;
  onChange: (l: TentLine) => void;
  onReplace: (lines: WorkLine[]) => void;
  allLines: WorkLine[];
  apiRef: React.RefObject<TentViewerApi | null>;
}) {
  const [tentId, setTentId] = useState(line.composition.tents[0]?.id ?? null);
  const [view, setView] = useState<"3d" | "plano">("3d");
  const [dateAlts, setDateAlts] = useState<{ offsetDays: number; ok: boolean; missing: number }[] | null>(null);
  const [pending, start] = useTransition();
  const tent = line.composition.tents.find((t) => t.id === tentId) ?? line.composition.tents[0];
  const family = tent ? catalogue.families.find((f) => f.id === tent.config.familyId) : null;

  const setConfig = (config: TentConfiguration) =>
    onChange({ ...line, composition: { ...line.composition, tents: line.composition.tents.map((t) => (t.id === tent!.id ? { ...t, config } : t)) } });
  const cfg = tent?.config;

  // availability of every catalogue item in the order window (this order excluded)
  const available = useMemo(() => {
    const range = { start: new Date(order.periodStart).getTime(), end: new Date(order.periodEnd).getTime() };
    const m = new Map<string, number>();
    for (const it of catalogue.items) {
      const stock = stocks.get(it.id) ?? { itemId: it.id, total: 0, inRepair: 0 };
      m.set(it.id, computeAvailability(stock, availability.reservations, availability.subrentals, range, { marginMinutes, excludeProjectId: order.id }).available);
    }
    // material used by the other lines of this order is not free for this tent
    return m;
  }, [catalogue.items, stocks, availability, order, marginMinutes]);

  const bomItems = useMemo(() => new Set(line.composition.tents.flatMap((t) => catalogue.rules.filter((r) => r.familyId === t.config.familyId).map((r) => r.itemId))), [line, catalogue.rules]);
  const shortages = [...checks.values()].filter((c) => c.shortage > 0 && bomItems.has(c.itemId));
  const alternatives = useMemo<Alternative[]>(() => {
    if (!shortages.length || !tent || !family) return [];
    return suggestAlternatives({ config: tent.config, family, catalog: { families: catalogue.families, rules: catalogue.rules, items: catalogue.items }, available }).filter((a) => a.kind !== "subalquiler");
  }, [shortages.length, tent, family, catalogue, available]);

  if (!tent || !family || !cfg) return null;
  const isJaima = family.roofShape === "jaima";
  const metrics = (() => {
    const largo = isJaima ? family.width : cfg.modules * family.moduleLength;
    return { largo, superficie: largo * family.width };
  })();

  const applyAlternative = (a: Alternative) => {
    if (a.kind === "familia") {
      const to = catalogue.families.find((f) => f.id === a.familyId);
      if (to) setConfig(transferConfiguration(cfg, to));
    } else if (a.kind === "partir") {
      const [p1, p2] = a.parts;
      const f2 = catalogue.families.find((f) => f.id === p2!.familyId)!;
      const first = { ...tent, config: resizeConfiguration(cfg, p1!.modules) };
      first.config = { ...first.config, fronts: { ...first.config.fronts, end: { type: "sin_pico", material: "blanco" } } };
      const secondCfg = transferConfiguration(resizeConfiguration(cfg, p2!.modules), f2);
      secondCfg.fronts = { ...secondCfg.fronts, start: { type: "sin_pico", material: "blanco" } };
      const second = { id: newKey(), label: `${tent.label || "Carpa"} (2)`, config: secondCfg, placement: { x: tent.placement.x + p1!.modules * family.moduleLength, y: tent.placement.y, rotation: tent.placement.rotation } };
      onChange({ ...line, composition: { ...line.composition, tents: [...line.composition.tents.map((t) => (t.id === tent.id ? first : t)), second], gutters: [...line.composition.gutters, { a: tent.id, b: second.id, length: family.width }] } });
      toast.success("Carpa partida en dos, unidas con canalón");
    }
  };

  const sideAll = (side: SideType) => setConfig({ ...cfg, bays: cfg.bays.map((b) => ({ ...b, left: side, right: side })) });
  const roofAll = (roof: RoofType) => setConfig({ ...cfg, bays: cfg.bays.map((b) => ({ ...b, roof })) });

  return (
    <section className="rounded-xl border bg-card" aria-label="Configurador de carpa">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h3 className="mr-2 text-[15px] font-semibold">Configurador</h3>
        <div className="flex flex-wrap gap-1">
          {line.composition.tents.map((t) => {
            const f = catalogue.families.find((x) => x.id === t.config.familyId);
            return (
              <button key={t.id} onClick={() => setTentId(t.id)} className={cn("rounded-full border px-3 py-1 text-xs", t.id === tent.id ? "border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : "hover:bg-accent")}>
                {t.label || f?.name} {f && f.roofShape !== "jaima" && !t.label ? `${f.width}x${t.config.modules * f.moduleLength}` : ""}
              </button>
            );
          })}
          {editable && (
            <button
              className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => {
                const last = line.composition.tents[line.composition.tents.length - 1]!;
                const f = catalogue.families.find((x) => x.id === last.config.familyId)!;
                const t = { id: newKey(), label: "", config: { ...defaultConfiguration(f, last.config.modules), anchoring: last.config.anchoring }, placement: { x: last.placement.x, y: last.placement.y + f.width + 3, rotation: last.placement.rotation } };
                onChange({ ...line, composition: { ...line.composition, tents: [...line.composition.tents, t] } });
                setTentId(t.id);
              }}
            >
              + Añadir estructura
            </button>
          )}
        </div>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={view === "3d" ? "secondary" : "ghost"} onClick={() => setView("3d")}><Box /> 3D</Button>
          <Button size="sm" variant={view === "plano" ? "secondary" : "ghost"} onClick={() => setView("plano")}><Layers /> Plano</Button>
        </div>
      </header>
      <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-[420px] border-b p-3 2xl:border-b-0 2xl:border-r">
          <div className="h-[460px]">
            {view === "3d" ? (
              <TentViewer composition={line.composition} families={catalogue.families} items={catalogue.items} rules={catalogue.rules} editable={editable} selectedTentId={tent.id} onSelectTent={setTentId} onChange={(c) => onChange({ ...line, composition: c })} showHuman showDimensions apiRef={apiRef} className="h-full" />
            ) : (
              <TentPlan composition={line.composition} families={catalogue.families} editable={editable} selectedTentId={tent.id} onSelectTent={setTentId} onChange={(c) => onChange({ ...line, composition: c })} className="h-full" />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span><span className="text-muted-foreground">Medidas</span> <strong className="tabular">{family.width}×{metrics.largo} m</strong></span>
            <span><span className="text-muted-foreground">Superficie</span> <strong className="tabular">{formatNumber(metrics.superficie)} m²</strong></span>
            <span><span className="text-muted-foreground">Altura</span> <strong className="tabular">{family.eaveHeight} / {family.ridgeHeight} m</strong></span>
            <span className="text-xs text-muted-foreground">Clic en techo, lateral o frente para cambiarlo</span>
          </div>
        </div>
        <div className="grid gap-4 p-4 text-sm sm:grid-cols-2 2xl:block 2xl:space-y-4 [&>*]:min-w-0">
          {editable ? (
            <>
              <Field label="Familia" htmlFor="tc-fam">
                <NativeSelect id="tc-fam" value={family.id} onChange={(e) => setConfig(transferConfiguration(cfg, catalogue.families.find((f) => f.id === e.target.value)!))}>
                  {catalogue.families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              {!isJaima && (
                <div className="flex items-end gap-3">
                  <Field label="Largo" htmlFor="tc-mod" className="flex-1">
                    <div className="flex items-center gap-1">
                      <Button size="icon-sm" variant="outline" aria-label="Quitar módulo" disabled={cfg.modules <= family.minModules} onClick={() => setConfig(resizeConfiguration(cfg, cfg.modules - 1))}><Minus /></Button>
                      <span id="tc-mod" className="tabular w-20 text-center font-medium">{cfg.modules * family.moduleLength} m</span>
                      <Button size="icon-sm" variant="outline" aria-label="Añadir módulo" disabled={cfg.modules >= family.maxModules} onClick={() => setConfig(resizeConfiguration(cfg, cfg.modules + 1))}><Plus /></Button>
                    </div>
                  </Field>
                  <span className="pb-2 text-xs text-muted-foreground">{cfg.modules} módulos · {cfg.modules + 1} pórticos</span>
                </div>
              )}
              <Field label="Fijación" htmlFor="tc-anch">
                <NativeSelect id="tc-anch" value={cfg.anchoring} onChange={(e) => setConfig({ ...cfg, anchoring: e.target.value as Anchoring })}>
                  {Object.entries(ANCHORING_LABELS).map(([k, v]) => <option key={k} value={k} disabled={k === "anclaje" && !order.anchoringAllowed}>{v}{k === "anclaje" && !order.anchoringAllowed ? " (no permitido en el lugar)" : ""}</option>)}
                </NativeSelect>
              </Field>
              {!isJaima && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Todo el techo" htmlFor="tc-roof">
                      <NativeSelect id="tc-roof" value="" onChange={(e) => e.target.value && roofAll(e.target.value as RoofType)}>
                        <option value="">Elegir…</option>
                        {Object.entries(ROOF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label="Todos los laterales" htmlFor="tc-sides">
                      <NativeSelect id="tc-sides" value="" onChange={(e) => e.target.value && sideAll(e.target.value as SideType)}>
                        <option value="">Elegir…</option>
                        {Object.entries(SIDE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </NativeSelect>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["start", "end"] as const).map((end) => (
                      <Field key={end} label={end === "start" ? "Frente inicial" : "Frente final"} htmlFor={`tc-f-${end}`}>
                        <NativeSelect
                          id={`tc-f-${end}`}
                          value={`${cfg.fronts[end].type}:${cfg.fronts[end].material}`}
                          onChange={(e) => {
                            const [type, material] = e.target.value.split(":") as [FrontType, FrontMaterial];
                            setConfig({ ...cfg, fronts: { ...cfg.fronts, [end]: { type, material } } });
                          }}
                        >
                          <option value="completo:blanco">{FRONT_LABELS.completo} blanco</option>
                          <option value="completo:transparente">{FRONT_LABELS.completo} transparente</option>
                          <option value="abierto:blanco">{FRONT_LABELS.abierto}</option>
                          <option value="sin_pico:blanco">{FRONT_LABELS.sin_pico}</option>
                        </NativeSelect>
                      </Field>
                    ))}
                  </div>
                  <details>
                    <summary className="cursor-pointer text-[13px] font-medium">Tramo a tramo</summary>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                      {cfg.bays.map((b, i) => (
                        <div key={i} className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-1">
                          <span className="text-xs text-muted-foreground">{i + 1}</span>
                          {(["roof", "left", "right"] as const).map((k) => (
                            <NativeSelect key={k} aria-label={`${k === "roof" ? "Techo" : k === "left" ? "Lateral izquierdo" : "Lateral derecho"} tramo ${i + 1}`} className="h-7 text-xs" value={b[k]} onChange={(e) => setConfig({ ...cfg, bays: cfg.bays.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })}>
                              {Object.entries(k === "roof" ? ROOF_LABELS : SIDE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </NativeSelect>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Suelos</p>
                {(["tarima", "suelo", "moqueta"] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between">
                    <label className="flex items-center gap-2 capitalize"><Switch checked={cfg.floors[k].enabled} onCheckedChange={(v) => setConfig({ ...cfg, floors: { ...cfg.floors, [k]: { ...cfg.floors[k], enabled: v } } })} /> {k}</label>
                    {cfg.floors[k].enabled && !isJaima && (
                      <span className="flex flex-wrap justify-end gap-0.5" aria-label={`Tramos con ${k}`}>
                        {cfg.bays.map((_, i) => {
                          const ex = cfg.floors[k].excludedBays.includes(i);
                          return (
                            <button key={i} title={`Tramo ${i + 1}`} onClick={() => setConfig({ ...cfg, floors: { ...cfg.floors, [k]: { ...cfg.floors[k], excludedBays: ex ? cfg.floors[k].excludedBays.filter((x) => x !== i) : [...cfg.floors[k].excludedBays, i] } } })} className={cn("size-5 rounded text-[10px]", ex ? "border border-dashed text-muted-foreground" : "bg-secondary")}>
                              {i + 1}
                            </button>
                          );
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Distribución" htmlFor="tc-lay">
                  <NativeSelect id="tc-lay" value={cfg.interior.layout} onChange={(e) => setConfig({ ...cfg, interior: { ...cfg.interior, layout: e.target.value as SeatingLayout } })}>
                    {Object.entries(LAYOUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Escenario" htmlFor="tc-stage">
                  <div className="flex h-9 items-center gap-2">
                    <Switch id="tc-stage" checked={cfg.interior.stage.enabled} onCheckedChange={(v) => setConfig({ ...cfg, interior: { ...cfg.interior, stage: { ...cfg.interior.stage, enabled: v } } })} />
                    {cfg.interior.stage.enabled && (
                      <span className="flex items-center gap-1 text-xs">
                        <input aria-label="Ancho escenario" type="number" min={2} max={family.width} value={cfg.interior.stage.width} onChange={(e) => setConfig({ ...cfg, interior: { ...cfg.interior, stage: { ...cfg.interior.stage, width: Number(e.target.value) } } })} className="h-7 w-11 rounded border px-1" />×
                        <input aria-label="Fondo escenario" type="number" min={1} max={20} value={cfg.interior.stage.depth} onChange={(e) => setConfig({ ...cfg, interior: { ...cfg.interior, stage: { ...cfg.interior.stage, depth: Number(e.target.value) } } })} className="h-7 w-11 rounded border px-1" />
                      </span>
                    )}
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={`Precio ${family.priceMode === "m2" ? "€/m²" : "€/ml"}`} htmlFor="tc-price">
                  <Input id="tc-price" type="number" step="0.1" min={0} value={line.unitPrice ?? family.price} onChange={(e) => onChange({ ...line, unitPrice: Number(e.target.value) })} />
                </Field>
                <Field label="Descuento %" htmlFor="tc-disc">
                  <Input id="tc-disc" type="number" min={0} max={100} value={line.discountPct} onChange={(e) => onChange({ ...line, discountPct: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Nombre en el presupuesto" htmlFor="tc-label">
                <Input id="tc-label" value={tent.label} placeholder={family.name} onChange={(e) => onChange({ ...line, composition: { ...line.composition, tents: line.composition.tents.map((t) => (t.id === tent.id ? { ...t, label: e.target.value } : t)) } })} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const name = prompt("Nombre de la plantilla", tent.label || family.name);
                    if (!name) return;
                    start(async () => {
                      const r = await saveAsTemplate({ name, composition: line.composition });
                      if (r.ok) toast.success("Plantilla guardada");
                      else toast.error(r.error);
                    });
                  }}
                >
                  <Save /> Guardar como plantilla
                </Button>
                {line.composition.tents.length > 1 && (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => { onChange({ ...line, composition: { ...line.composition, tents: line.composition.tents.filter((t) => t.id !== tent.id), gutters: line.composition.gutters.filter((g) => g.a !== tent.id && g.b !== tent.id) } }); setTentId(line.composition.tents[0]!.id); }}>
                    Quitar esta estructura
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={async () => { const b = await apiRef.current?.toGLTF(); if (b) { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `carpa-${order.number}.glb`; a.click(); } }}>
                  <Download /> glTF
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Pedido cerrado: la configuración es de solo lectura.</p>
          )}
        </div>
      </div>
      {shortages.length > 0 && (
        <div className="space-y-3 border-t bg-danger-bg/40 p-4">
          <h4 className="text-sm font-semibold text-danger">Falta material para estas fechas</h4>
          <ul className="space-y-2 text-sm">
            {shortages.map((s) => {
              const it = catalogue.items.find((i) => i.id === s.itemId);
              return (
                <li key={s.itemId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
                  <span>
                    <StatusPill tone="danger">Faltan {s.shortage}</StatusPill> <span className="ml-1 font-medium">{it?.name}</span>
                    <span className="block text-xs text-muted-foreground">Ocupado por: {s.occupants.map((o) => `${o.projectName} (${o.quantity}${o.status !== "confirmado" ? `, ${o.status}` : ""})`).join(" · ") || "—"}</span>
                  </span>
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await createSubrentalForShortage({ orderId: order.id, itemId: s.itemId, quantity: s.shortage, supplierId: null, cost: 0 });
                          if (r.ok) toast.success("Subalquiler solicitado: confírmalo con el proveedor en Subalquileres");
                          else toast.error(r.error);
                        })
                      }
                    >
                      <Truck /> Subalquilar {s.shortage}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {editable && (
            <div className="space-y-2">
              <p className="text-[13px] font-medium">Alternativas</p>
              <div className="flex flex-wrap gap-2">
                {alternatives.map((a, i) => (
                  <Button key={i} size="sm" variant="outline" onClick={() => applyAlternative(a)}>
                    {a.kind === "partir" ? <Split /> : <Layers />} {a.description}
                  </Button>
                ))}
                {alternatives.length === 0 && <span className="text-xs text-muted-foreground">Ninguna familia ni partición cubre la escasez.</span>}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await dateAlternatives({ orderId: order.id, lines: allLines });
                      if (r.ok) setDateAlts(r.data);
                      else toast.error(r.error);
                    })
                  }
                >
                  <Search /> Mover fechas
                </Button>
              </div>
              {dateAlts && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {dateAlts.map((d) => (
                    <StatusPill key={d.offsetDays} tone={d.ok ? "success" : "neutral"}>
                      {d.offsetDays > 0 ? `+${d.offsetDays}` : d.offsetDays} d · {d.ok ? "cabe" : `faltan ${d.missing}`}
                    </StatusPill>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
