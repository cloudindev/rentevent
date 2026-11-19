"use client";
/**
 * Animated mock of the 3D viewer for the marketing site: the tent grows module
 * by module, then a cursor turns side walls transparent and removes a roof
 * panel while the figures update, as in the real configurator.
 */
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn, formatEUR, formatNumber } from "@/lib/utils";
import { TentIllustration } from "./tent-illustration";

const M = 5; // module length (m)
const W = 15; // tent width (m)
const EAVE = 3;
const RIDGE = 5.4;

type Step = {
  modules: number;
  transparent: number;
  openRoof: number;
  /** cursor target in tent coordinates, or null to hide it */
  cursor: [number, number, number] | null;
  highlight: { type: "side"; bay: number } | { type: "roof"; bay: number } | null;
  click?: boolean;
  plus?: boolean;
  toast?: string;
  ms: number;
};

const side = (bay: number): [number, number, number] => [(bay + 0.5) * M, EAVE * 0.5, W / 2];
const roof = (bay: number): [number, number, number] => [(bay + 0.5) * M, (EAVE + RIDGE) / 2, W / 4];

const STEPS: Step[] = [
  { modules: 3, transparent: 0, openRoof: 0, cursor: null, highlight: null, ms: 1100 },
  { modules: 4, transparent: 0, openRoof: 0, cursor: null, highlight: null, plus: true, toast: "Largo 20 m · despiece recalculado", ms: 750 },
  { modules: 5, transparent: 0, openRoof: 0, cursor: null, highlight: null, plus: true, toast: "Largo 25 m · despiece recalculado", ms: 750 },
  { modules: 6, transparent: 0, openRoof: 0, cursor: null, highlight: null, plus: true, toast: "Largo 30 m · despiece recalculado", ms: 1200 },
  { modules: 6, transparent: 0, openRoof: 0, cursor: side(0), highlight: { type: "side", bay: 0 }, ms: 900 },
  { modules: 6, transparent: 1, openRoof: 0, cursor: side(0), highlight: null, click: true, toast: "Lateral transparente · tramo 1", ms: 700 },
  { modules: 6, transparent: 1, openRoof: 0, cursor: side(1), highlight: { type: "side", bay: 1 }, ms: 650 },
  { modules: 6, transparent: 2, openRoof: 0, cursor: side(1), highlight: null, click: true, toast: "Lateral transparente · tramo 2", ms: 650 },
  { modules: 6, transparent: 2, openRoof: 0, cursor: side(2), highlight: { type: "side", bay: 2 }, ms: 650 },
  { modules: 6, transparent: 3, openRoof: 0, cursor: side(2), highlight: null, click: true, toast: "Lateral transparente · tramo 3", ms: 1000 },
  { modules: 6, transparent: 3, openRoof: 0, cursor: roof(5), highlight: { type: "roof", bay: 5 }, ms: 1000 },
  { modules: 6, transparent: 3, openRoof: 1, cursor: roof(5), highlight: null, click: true, toast: "Tramo 6 sin techo", ms: 1400 },
  { modules: 6, transparent: 3, openRoof: 1, cursor: null, highlight: null, toast: "Presupuesto actualizado", ms: 2600 },
];

/** Figures in the same spirit as the real BOM (illustrative values). */
function figures(s: Step) {
  const porticos = s.modules + 1;
  const sides = 2 * s.modules;
  const roofs = s.modules - s.openRoof;
  const area = W * s.modules * M;
  const weight = porticos * 410 + roofs * 95 + (sides - s.transparent) * 38 + s.transparent * 44 + porticos * 2 * 500;
  const price = area * 9 + s.transparent * 18 * 4 - s.openRoof * 60;
  return {
    area,
    weight,
    price,
    lines: [
      ["Cercha 15 m", porticos],
      ["Lona techo", roofs],
      ["Lateral blanco", sides - s.transparent],
      ["Lateral cristal", s.transparent],
    ] as const,
  };
}

export function TentDemo() {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      const t = setTimeout(() => {
        setReduced(true);
        setI(STEPS.length - 1);
      }, 0);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEPS[i]!.ms);
    return () => clearTimeout(t);
  }, [i, reduced]);

  const s = STEPS[i]!;
  const f = figures(s);

  return (
    <div className="rounded-2xl border bg-canvas p-2 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.3)]" aria-hidden>
      <div className="overflow-hidden rounded-xl border bg-background">
        {/* toolbar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs">
          <span className="rounded-md border px-2 py-1 font-medium">Carpa 15 m pata baja</span>
          <span className="hidden rounded-md border px-2 py-1 text-muted-foreground sm:inline">Pesos</span>
          <div className="ml-auto flex rounded-md bg-subtle p-0.5">
            <span className="rounded bg-background px-2 py-0.5 font-medium shadow-sm">Vista 3D</span>
            <span className="px-2 py-0.5 text-muted-foreground">Plano 2D</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_168px]">
          {/* viewer */}
          <div className="relative bg-gradient-to-b from-subtle to-background">
            <TentIllustration
              modules={s.modules}
              frameModules={6}
              transparentBays={s.transparent}
              openRoofBays={s.openRoof}
              highlight={s.highlight}
              className="w-full px-3 pb-12 pt-3 text-foreground"
              title="Vista 3D de la carpa"
              overlay={(P) => {
                if (!s.cursor) return null;
                const [x, y] = P(...s.cursor);
                return (
                  <g style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 600ms cubic-bezier(.4,0,.2,1)" }}>
                    {s.click && (
                      <circle r="4" fill="none" stroke="#f95f40" strokeWidth="1.5" key={i}>
                        <animate attributeName="r" from="3" to="16" dur="0.6s" fill="freeze" />
                        <animate attributeName="opacity" from="1" to="0" dur="0.6s" fill="freeze" />
                      </circle>
                    )}
                    <path d="M0 0 L0 15 L4 11 L7 18 L10 17 L7 10 L12 10 Z" fill="#111" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
                  </g>
                );
              }}
            />
            {/* module counter, like the real viewer */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-2 py-1 text-xs shadow-sm">
              <Minus className="size-3.5 text-muted-foreground" />
              <span className="tabular font-medium">
                {s.modules} módulos · {W}×{s.modules * M}
              </span>
              <span className={cn("rounded-full p-0.5 transition-colors", s.plus && "bg-brand-500 text-white")}>
                <Plus className="size-3.5" />
              </span>
            </div>
            {s.toast && (
              <div key={i} className="absolute left-3 top-3 rounded-lg border bg-background/95 px-2.5 py-1.5 text-[11px] font-medium shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-brand-500 align-middle" />
                {s.toast}
              </div>
            )}
          </div>

          {/* live figures */}
          <div className="space-y-2 border-t p-3 text-xs sm:border-l sm:border-t-0">
            {[
              ["Superficie", `${formatNumber(f.area)} m²`],
              ["Peso", `${formatNumber(f.weight)} kg`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border px-2.5 py-1.5">
                <p className="text-[10px] text-muted-foreground">{k}</p>
                <p className="tabular font-medium">{v}</p>
              </div>
            ))}
            <div className="rounded-lg border">
              {f.lines.map(([name, qty]) => (
                <div key={name} className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5 last:border-0">
                  <span className="truncate text-muted-foreground">{name}</span>
                  <span key={`${name}${qty}`} className="tabular font-medium animate-in fade-in zoom-in-95 duration-300">
                    {qty}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-foreground px-2.5 py-2 text-background">
              <p className="text-[10px] opacity-70">Total sin IVA</p>
              <p key={f.price} className="tabular text-sm font-semibold animate-in fade-in duration-300">
                {formatEUR(f.price)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
