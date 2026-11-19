"use client";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Tent, Trash2 } from "lucide-react";
import type { LineCheck } from "@rentevent/core";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { cn, formatEUR, formatNumber } from "@/lib/utils";
import { tentLabel, type Catalogue, type WorkLine, type orderTotals } from "@/lib/order-model";

export type SelectedRow = { kind: "carpa" | "articulo" | "otro"; lineKey: string; itemId: string | null };

export function AvailabilityPill({ check }: { check: LineCheck | undefined }) {
  if (!check) return <span className="text-xs text-muted-foreground">—</span>;
  if (check.status === "short") return <StatusPill tone="danger">Faltan {check.shortage}</StatusPill>;
  if (check.status === "tight") return <StatusPill tone="warning">Justo</StatusPill>;
  return <StatusPill tone="success">Disponible</StatusPill>;
}

function NumberInput({ value, onChange, step = 1, label, className }: { value: number; onChange: (v: number) => void; step?: number; label: string; className?: string }) {
  return (
    <input
      type="number"
      aria-label={label}
      min={0}
      step={step}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      className={cn("tabular h-7 w-20 rounded-md border border-transparent bg-transparent px-1.5 text-right hover:border-input focus:border-input focus:bg-background focus:outline-none", className)}
    />
  );
}

export function LinesTable({
  lines,
  catalogue,
  computed,
  checks,
  selected,
  onSelect,
  onChange,
}: {
  lines: WorkLine[];
  catalogue: Catalogue;
  computed: ReturnType<typeof orderTotals>;
  checks: Map<string, LineCheck>;
  selected: SelectedRow | null;
  onSelect: (s: SelectedRow | null) => void;
  onChange?: (l: WorkLine[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const itemById = new Map(catalogue.items.map((i) => [i.id, i]));
  const set = (key: string, patch: Partial<WorkLine>) => onChange?.(lines.map((l) => (l.key === key ? ({ ...l, ...patch } as WorkLine) : l)));
  const remove = (key: string) => {
    onChange?.(lines.filter((l) => l.key !== key));
    if (selected?.lineKey === key) onSelect(null);
  };
  const rowTotal = (key: string) => computed.rowNet.get(key) ?? 0;

  if (lines.length === 0)
    return <EmptyState icon={Tent} title="El pedido está vacío" description="Busca arriba una carpa, un artículo, un kit o un servicio para añadirlo. Las carpas calculan su despiece solas." />;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-subtle">
          <tr className="border-b text-[13px] text-muted-foreground">
            <th className="h-10 px-4 text-left font-normal">Artículo</th>
            <th className="w-24 px-2 text-right font-normal">Cant.</th>
            <th className="w-20 px-2 text-right font-normal">Libres</th>
            <th className="w-36 px-4 text-left font-normal">Disponibilidad</th>
            <th className="w-28 px-2 text-right font-normal">Importe</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            if (l.kind === "carpa") {
              const bom = computed.boms.get(l.key);
              const truss = l.composition.tents.map((t) => catalogue.families.find((f) => f.id === t.config.familyId)?.trussItemId).find(Boolean) ?? null;
              const subChecks = (bom?.lines ?? []).map((b) => checks.get(b.itemId)).filter(Boolean) as LineCheck[];
              const worst = subChecks.find((c) => c.status === "short") ?? subChecks.find((c) => c.status === "tight") ?? subChecks[0];
              const isOpen = expanded.has(l.key);
              const isSel = selected?.lineKey === l.key && selected.kind === "carpa";
              return (
                <Fragment key={l.key}>
                  <tr data-selected={isSel} onClick={() => onSelect({ kind: "carpa", lineKey: l.key, itemId: truss })} className="cursor-pointer border-b hover:bg-subtle data-[selected=true]:bg-accent">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={isOpen ? "Ocultar despiece" : "Ver despiece"}
                          aria-expanded={isOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((s) => {
                              const n = new Set(s);
                              if (n.has(l.key)) n.delete(l.key);
                              else n.add(l.key);
                              return n;
                            });
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:bg-background"
                        >
                          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                        <Tent className="size-4 text-muted-foreground" strokeWidth={1.6} />
                        <span className="font-medium">{tentLabel(l, catalogue)}</span>
                        <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:inline">{bom ? `${formatNumber(bom.totals.superficie)} m² · ${bom.lines.length} piezas` : ""}</span>
                      </div>
                    </td>
                    <td className="tabular px-2 text-right">{l.composition.tents.length}</td>
                    <td className="tabular px-2 text-right">{truss && checks.get(truss) ? checks.get(truss)!.available : "—"}</td>
                    <td className="px-4">
                      {worst?.status === "short" ? (
                        <StatusPill tone="danger">Faltan {worst.shortage}{worst.itemId !== truss ? ` · ${itemById.get(worst.itemId)?.name.split(" ").slice(0, 2).join(" ")}` : ""}</StatusPill>
                      ) : (
                        <AvailabilityPill check={worst} />
                      )}
                    </td>
                    <td className="tabular px-2 text-right">{formatEUR(rowTotal(l.key))}</td>
                    <td className="pr-2">
                      {onChange && (
                        <button aria-label="Quitar carpa" onClick={(e) => { e.stopPropagation(); remove(l.key); }} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-danger">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen &&
                    bom?.lines.map((b) => {
                      const it = itemById.get(b.itemId);
                      const sel = selected?.itemId === b.itemId && selected.lineKey === l.key && selected.kind === "articulo";
                      return (
                        <tr key={`${l.key}-${b.itemId}`} data-selected={sel} onClick={() => onSelect({ kind: "articulo", lineKey: l.key, itemId: b.itemId })} className="cursor-pointer border-b bg-subtle/40 text-[13px] hover:bg-subtle data-[selected=true]:bg-accent">
                          <td className="py-2 pl-14 pr-4 text-foreground/80">{it?.name ?? b.itemId}</td>
                          <td className="tabular px-2 text-right">{formatNumber(b.quantity)}{it?.unit === "m2" ? " m²" : ""}</td>
                          <td className="tabular px-2 text-right text-muted-foreground">{checks.get(b.itemId)?.available ?? "—"}</td>
                          <td className="px-4"><AvailabilityPill check={checks.get(b.itemId)} /></td>
                          <td className="px-2 text-right text-xs text-muted-foreground">{it && it.priceMode !== "incluido" && it.price > 0 ? formatEUR(it.price * b.quantity) : "incluido"}</td>
                          <td />
                        </tr>
                      );
                    })}
                </Fragment>
              );
            }
            if (l.kind === "articulo") {
              const c = checks.get(l.itemId);
              const sel = selected?.lineKey === l.key;
              return (
                <tr key={l.key} data-selected={sel} onClick={() => onSelect({ kind: "articulo", lineKey: l.key, itemId: l.itemId })} className="cursor-pointer border-b hover:bg-subtle data-[selected=true]:bg-accent">
                  <td className="px-4 py-3 font-medium">{l.description}</td>
                  <td className="px-2 text-right">{onChange ? <NumberInput label="Cantidad" value={l.quantity} onChange={(v) => set(l.key, { quantity: v })} /> : formatNumber(l.quantity)}</td>
                  <td className="tabular px-2 text-right">{c?.available ?? "—"}</td>
                  <td className="px-4"><AvailabilityPill check={c} /></td>
                  <td className="tabular px-2 text-right">{formatEUR(rowTotal(l.key))}</td>
                  <td className="pr-2">{onChange && <button aria-label="Quitar línea" onClick={(e) => { e.stopPropagation(); remove(l.key); }} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-danger"><Trash2 className="size-4" /></button>}</td>
                </tr>
              );
            }
            if (l.kind === "kit") {
              const kit = catalogue.kits.find((k) => k.id === l.kitId);
              const kc = (kit?.items ?? []).map((i) => checks.get(i.itemId)).filter(Boolean) as LineCheck[];
              const worst = kc.find((c) => c.status === "short") ?? kc.find((c) => c.status === "tight") ?? kc[0];
              return (
                <tr key={l.key} onClick={() => onSelect({ kind: "otro", lineKey: l.key, itemId: null })} className="cursor-pointer border-b hover:bg-subtle">
                  <td className="px-4 py-3 font-medium">{l.description} <span className="text-xs font-normal text-muted-foreground">kit · {kit?.items.length ?? 0} artículos</span></td>
                  <td className="px-2 text-right">{onChange ? <NumberInput label="Cantidad" value={l.quantity} onChange={(v) => set(l.key, { quantity: v })} /> : l.quantity}</td>
                  <td className="px-2 text-right text-muted-foreground">—</td>
                  <td className="px-4"><AvailabilityPill check={worst} /></td>
                  <td className="tabular px-2 text-right">{formatEUR(rowTotal(l.key))}</td>
                  <td className="pr-2">{onChange && <button aria-label="Quitar kit" onClick={(e) => { e.stopPropagation(); remove(l.key); }} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-danger"><Trash2 className="size-4" /></button>}</td>
                </tr>
              );
            }
            return (
              <tr key={l.key} className="border-b hover:bg-subtle">
                <td className="px-4 py-3">
                  {onChange ? (
                    <input aria-label="Descripción" value={l.description} onChange={(e) => set(l.key, { description: e.target.value })} className={cn("w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 hover:border-input focus:border-input focus:bg-background focus:outline-none", l.kind === "texto" ? "italic text-muted-foreground" : "font-medium")} />
                  ) : (
                    l.description
                  )}
                </td>
                <td className="px-2 text-right">{l.kind !== "texto" && (onChange ? <NumberInput label="Cantidad" value={l.quantity} step={0.5} onChange={(v) => set(l.key, { quantity: v })} /> : formatNumber(l.quantity))}</td>
                <td className="px-2 text-right text-muted-foreground">—</td>
                <td className="px-4 text-xs text-muted-foreground">
                  {l.kind !== "texto" ? (
                    <span className="inline-flex items-center gap-1">
                      × {onChange ? <NumberInput label="Precio unitario" value={l.unitPrice} step={0.5} onChange={(v) => set(l.key, { unitPrice: v })} className="w-16" /> : formatEUR(l.unitPrice)} €
                      <span>{l.kind === "transporte" ? "transporte" : l.kind === "mano_obra" ? "/h" : ""}</span>
                    </span>
                  ) : (
                    "Texto"
                  )}
                </td>
                <td className="tabular px-2 text-right">{l.kind !== "texto" && formatEUR(rowTotal(l.key))}</td>
                <td className="pr-2">{onChange && <button aria-label="Quitar línea" onClick={() => remove(l.key)} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-danger"><Trash2 className="size-4" /></button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
