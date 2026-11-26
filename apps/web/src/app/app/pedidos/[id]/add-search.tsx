"use client";
import { useMemo, useRef, useState } from "react";
import { Box, Package, Search, Tent, Truck, HardHat, Type, Wrench } from "lucide-react";
import { defaultConfiguration, laborLine, transportLine, type PricingSettings } from "@rentevent/core";
import { newKey, type Catalogue, type WorkLine, type orderTotals } from "@/lib/order-model";
import type { OrderWorkspaceData } from "@/server/orders";
import { cn, formatEUR, formatNumber } from "@/lib/utils";

type Option = { id: string; group: string; label: string; hint?: string; icon: typeof Box; make: () => WorkLine };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AddSearch({
  catalogue,
  lines,
  onChange,
  freeOf,
  order,
  computed,
  pricing,
  onAddedTent,
}: {
  catalogue: Catalogue;
  lines: WorkLine[];
  onChange: (l: WorkLine[]) => void;
  freeOf: (itemId: string) => number | null;
  order: OrderWorkspaceData["order"];
  computed: ReturnType<typeof orderTotals>;
  pricing: PricingSettings;
  onAddedTent: (key: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo<Option[]>(() => {
    const opts: Option[] = [];
    for (const f of catalogue.families) {
      if (f.active === false) continue;
      const truss = f.trussItemId ? catalogue.items.find((i) => i.id === f.trussItemId) : null;
      opts.push({
        id: `f-${f.id}`,
        group: "Carpas",
        label: f.name,
        hint: `${f.roofShape === "jaima" ? `${f.width}x${f.width} m` : `${f.width} m · módulos de ${f.moduleLength} m`}${truss ? ` · ${truss.sku}` : ""}`,
        icon: Tent,
        make: () => {
          const config = defaultConfiguration(f, f.roofShape === "jaima" ? 1 : 4);
          if (!order.anchoringAllowed) config.anchoring = "pesos";
          return { key: newKey(), kind: "carpa", tentConfigId: null, label: "", composition: { version: 1, tents: [{ id: newKey(), label: "", config, placement: { x: 0, y: 0, rotation: 0 } }], gutters: [], site: null }, unitPrice: null, discountPct: 0 };
        },
      });
    }
    for (const it of catalogue.items) {
      if (it.role === "cercha") continue;
      opts.push({
        id: `i-${it.id}`,
        group: "Artículos",
        label: it.name,
        hint: `${it.sku} · ${it.priceMode === "incluido" ? "incluido" : formatEUR(it.price)}`,
        icon: Box,
        make: () => ({ key: newKey(), kind: "articulo", itemId: it.id, description: it.name, quantity: 1, unitPrice: it.price, priceMode: it.priceMode === "incluido" ? "unidad" : it.priceMode, discountPct: 0 }),
      });
    }
    for (const k of catalogue.kits) {
      opts.push({ id: `k-${k.id}`, group: "Kits", label: k.name, hint: `${k.items.length} artículos · ${formatEUR(k.price)}`, icon: Package, make: () => ({ key: newKey(), kind: "kit", kitId: k.id, description: k.name, quantity: 1, unitPrice: k.price, discountPct: 0 }) });
    }
    const weight = [...computed.boms.values()].reduce((s, b) => s + b.totals.weightKg, 0);
    // "Viajes" in the order data wins; left at 1, the trips come from the vehicles the despiece needs
    const trips = order.trips > 1 ? order.trips : Math.max(1, ...[...computed.boms.values()].flatMap((b) => b.tents.map((t) => t.result.vehicles[0]?.count ?? 1)));
    const hours = [...computed.boms.values()].reduce((s, b) => s + b.totals.montajeHoras + b.totals.desmontajeHoras, 0);
    if (order.distanceKm != null) {
      opts.push({ id: "s-transporte", group: "Servicios", label: `Transporte (${Math.round(order.distanceKm)} km, ${trips} viaje${trips > 1 ? "s" : ""})`, hint: weight ? `${formatNumber(weight / 1000)} t de material` : undefined, icon: Truck, make: () => ({ key: newKey(), ...transportLine(order.distanceKm!, trips, pricing), kind: "transporte", unitCost: transportLine(order.distanceKm!, trips, pricing).unitCost ?? 0 }) });
    }
    if (hours > 0) opts.push({ id: "s-mo", group: "Servicios", label: `Montaje y desmontaje (${formatNumber(hours)} h·persona)`, hint: "Calculado desde el despiece", icon: HardHat, make: () => ({ key: newKey(), ...laborLine(hours, pricing), kind: "mano_obra", unitCost: pricing.laborCostPerHour }) });
    opts.push({ id: "s-servicio", group: "Servicios", label: q.trim() ? `Servicio: “${q.trim()}”` : "Servicio libre", icon: Wrench, make: () => ({ key: newKey(), kind: "servicio", description: q.trim() || "Servicio", quantity: 1, unitPrice: 0, priceMode: "unidad", discountPct: 0, unitCost: 0 }) });
    opts.push({ id: "s-texto", group: "Servicios", label: "Línea de texto", icon: Type, make: () => ({ key: newKey(), kind: "texto", description: q.trim() || "Nota", quantity: 0, unitPrice: 0, priceMode: "incluido", discountPct: 0, unitCost: 0 }) });
    return opts;
  }, [catalogue, order, computed.boms, pricing, q]);

  const filtered = useMemo(() => {
    const n = norm(q.trim());
    const list = n ? options.filter((o) => norm(`${o.label} ${o.hint ?? ""}`).includes(n) || o.group === "Servicios") : options.filter((o) => o.group !== "Artículos").concat(options.filter((o) => o.group === "Artículos").slice(0, 6));
    return list.slice(0, 40);
  }, [options, q]);

  const pick = (o: Option) => {
    const line = o.make();
    onChange([...lines, line]);
    if (line.kind === "carpa") onAddedTent(line.key);
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
  };

  let lastGroup = "";
  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2.5 rounded-xl border bg-background px-3.5 focus-within:outline-2 focus-within:outline-ring">
        <Search className="size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && filtered[active]) {
              e.preventDefault();
              pick(filtered[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Añadir carpas, artículos, kits o servicios…"
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          role="combobox"
          aria-expanded={open}
          aria-controls="add-search-list"
          aria-label="Añadir carpas, artículos, kits o servicios"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul id="add-search-list" role="listbox" className="absolute inset-x-0 top-12 z-30 max-h-[420px] overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-xl">
          {filtered.map((o, i) => {
            const header = o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            const free = o.id.startsWith("i-") ? freeOf(o.id.slice(2)) : null;
            return (
              <li key={o.id} role="presentation">
                {header && <p className="px-2.5 pb-1 pt-2 text-xs text-muted-foreground">{header}</p>}
                <button
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm", i === active && "bg-accent")}
                >
                  <o.icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{o.hint}</span>}
                  {free != null && <span className="tabular text-xs text-muted-foreground">{free} libres</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
