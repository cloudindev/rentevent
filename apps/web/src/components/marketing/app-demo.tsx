"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, ListChecks, Pause, Play, RotateCcw, Search, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { TentIllustration } from "./tent-illustration";

/**
 * Animated, self-contained mock of the Rentevent order screen for the home
 * hero. Pure React/CSS — no screenshots. Steps loop; pause/replay controls.
 */
const STEPS = 7;
const STEP_MS = 1900;

type Row = { name: string; qty: number; free: number; tone: "ok" | "short" | "tight"; label: string };

function Pill({ tone, children }: { tone: "ok" | "short" | "tight" | "neutral" | "brand"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-success-bg text-success",
    short: "bg-danger-bg text-danger",
    tight: "bg-warning-bg text-warning",
    neutral: "bg-secondary text-foreground/70",
    brand: "bg-brand-50 text-brand-700",
  }[tone];
  const dot = { ok: "bg-success", short: "bg-danger", tight: "bg-warning", neutral: "bg-muted-foreground", brand: "bg-brand-500" }[tone];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium transition-colors duration-500", cls)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}

const MQ = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const m = window.matchMedia(MQ);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const prefersReduced = () => window.matchMedia(MQ).matches;

const DAYS = ["Mié", "Jue · carga", "Vie", "Sáb", "Dom", "Lun · retorno", "Mar"];

export function AppDemo() {
  const reduced = useSyncExternalStore(subscribeMotion, prefersReduced, () => false);
  const [rawStep, setStep] = useState(0);
  const [rawPlaying, setPlaying] = useState(true);
  const [touched, setTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playing = rawPlaying && (!reduced || touched);
  const step = reduced && !touched ? STEPS - 1 : rawStep;

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setStep((s) => (s + 1) % STEPS), STEP_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  const modules = step >= 1 ? 6 : 4;
  const subrental = step >= 5;
  const rows: Row[] = [
    { name: "Cercha 15 m pata baja", qty: modules + 1, free: 5, tone: modules + 1 > 5 && !subrental ? "short" : "ok", label: modules + 1 > 5 && !subrental ? `Faltan ${modules + 1 - 5}` : subrental ? "Cubierto" : "Disponible" },
    { name: "Lateral 5 m transparente", qty: step >= 2 ? 6 : 0, free: 78, tone: "ok", label: "Disponible" },
    { name: "Lona de techo 15x5 blanca", qty: modules - (step >= 1 ? 1 : 0), free: 12, tone: "tight", label: "Justo" },
    { name: "Peso de hormigón 500 kg", qty: (modules + 1) * 4, free: 340, tone: "ok", label: "Disponible" },
  ];
  const cercha = rows[0]!;
  const otherUse = [2, 2, 2, 0, 0, 0, 0];
  const mine = [0, cercha.qty, cercha.qty, cercha.qty, cercha.qty, cercha.qty, 0];
  const stock = 32;
  const external = [25, 25, 25, 25, 25, 25, 0];
  const sub = subrental ? [0, 2, 2, 2, 2, 2, 0] : [0, 0, 0, 0, 0, 0, 0];
  const free = otherUse.map((u, i) => stock - u - external[i]! - mine[i]! + sub[i]!);

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border bg-canvas p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]" aria-hidden="true">
        <div className="flex overflow-hidden rounded-xl border bg-background">
          {/* mini sidebar */}
          <div className="hidden w-32 shrink-0 flex-col gap-1 border-r p-2.5 2xl:flex">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="flex size-5 items-center justify-center rounded bg-ink text-[8px] font-bold text-white">CN</span>
              <span className="truncate text-[11px] font-semibold">Carpas del Norte</span>
            </div>
            {["Inicio", "Agenda", "Pedidos", "Proyectos", "Contactos", "Inventario", "Carpas", "Personal"].map((l) => (
              <span key={l} className={cn("rounded-md px-2 py-1 text-[11px] text-foreground/70", l === "Pedidos" && "bg-accent font-medium text-foreground")}>
                {l}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <ListChecks className="size-3.5 text-foreground/60" />
              <span className="truncate text-[12px] font-semibold">Pedido 262087 · Boda en Finca La Quintana</span>
              <span className="ml-auto hidden items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] md:inline-flex">
                <CalendarDays className="size-3" /> Vie 4 – Dom 6 dic
              </span>
              <Pill tone={step >= 6 ? "ok" : step >= 3 ? "tight" : "neutral"}>{step >= 6 ? "Confirmado" : step >= 3 ? "Opción" : "Borrador"}</Pill>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <Search className="size-3" />
                <span className="truncate">{step === 0 ? "Añadir carpas, artículos, kits o servicios…" : `Carpa 15x${modules * 5} a dos aguas · pesos · 3 tramos transparentes`}</span>
              </div>
              <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_170px]">
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_30px_34px_86px] gap-2 bg-subtle px-2.5 py-1.5 text-[10px] text-muted-foreground">
                    <span>Artículo</span>
                    <span className="text-right">Cant.</span>
                    <span className="text-right">Libres</span>
                    <span>Disponibilidad</span>
                  </div>
                  {rows.map((r, i) => (
                    <div
                      key={r.name}
                      className={cn(
                        "grid grid-cols-[minmax(0,1fr)_30px_34px_86px] items-center gap-2 border-t px-2.5 py-1.5 text-[11px] transition-colors duration-500",
                        i === 0 && step >= 3 && "bg-accent",
                        r.qty === 0 && "opacity-40",
                      )}
                    >
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="text-right tabular-nums">{r.qty}</span>
                      <span className="text-right tabular-nums text-muted-foreground">{r.free}</span>
                      <Pill tone={r.tone}>{r.label}</Pill>
                    </div>
                  ))}
                </div>
                <div className="relative hidden overflow-hidden rounded-lg border bg-gradient-to-b from-subtle to-background lg:block">
                  <span className="absolute left-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">3D</span>
                  <TentIllustration modules={modules} transparentBays={step >= 2 ? 3 : 0} openRoofBays={step >= 1 ? 1 : 0} className="h-full w-full p-2 text-foreground transition-all duration-700" title="Vista 3D de la carpa del pedido" />
                </div>
              </div>
              <div className={cn("overflow-hidden rounded-lg border transition-all duration-700", step >= 3 ? "max-h-64 opacity-100" : "max-h-0 border-transparent opacity-0")}>
                <div className="px-2.5 pt-2 text-[11px]">
                  <strong>Cercha 15 m pata baja</strong> <span className="text-muted-foreground">{stock} en stock</span>
                </div>
                <div className="overflow-x-auto px-2.5 pb-2.5 pt-1.5">
                  <div className="grid min-w-[420px] grid-cols-[78px_repeat(7,1fr)] gap-1 text-[9.5px]">
                    <span />
                    {DAYS.map((d) => (
                      <span key={d} className="truncate text-muted-foreground">
                        {d}
                      </span>
                    ))}
                    <span className="truncate text-muted-foreground">Mercado navideño</span>
                    <span className="col-span-6 truncate rounded-full border bg-secondary px-1.5 py-0.5">25 uds. · hasta el lunes</span>
                    <span />
                    <span className="truncate text-muted-foreground">Este pedido</span>
                    <span />
                    <span className="col-span-5 truncate rounded-full border border-brand-300 bg-brand-50 px-1.5 py-0.5 text-brand-800">{cercha.qty} uds. · Boda</span>
                    <span />
                    <span className="truncate text-muted-foreground">Subalquiler</span>
                    <span />
                    <span className={cn("col-span-5 truncate rounded-full border px-1.5 py-0.5 transition-opacity duration-500", subrental ? "border-success/40 bg-success-bg text-success opacity-100" : "opacity-0")}>+2 uds. · Estructuras Cantábricas</span>
                    <span />
                    <span className="font-medium">Libres</span>
                    {free.map((f, i) => (
                      <span key={i} className={cn("rounded py-0.5 text-center font-medium tabular-nums transition-colors duration-500", f < 0 ? "bg-danger-bg text-danger" : i === 0 || i === 6 ? "bg-secondary" : "bg-success-bg text-success")}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[13px] text-muted-foreground">
        <span className="sr-only" aria-live="polite">
          Paso {step + 1} de {STEPS}
        </span>
        <button onClick={() => (setTouched(true), setPlaying(!playing))} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground">
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {playing ? "Pausar" : "Reanudar"}
        </button>
        <button
          onClick={() => {
            setTouched(true);
            setStep(0);
            setPlaying(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="size-3.5" /> Repetir
        </button>
        <button
          onClick={() => {
            setTouched(true);
            setPlaying(false);
            setStep(STEPS - 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent hover:text-foreground"
        >
          <SkipForward className="size-3.5" /> Ver resultado
        </button>
      </div>
    </div>
  );
}
