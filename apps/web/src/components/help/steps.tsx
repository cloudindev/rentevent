"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lightbulb, ListOrdered, RotateCcw, Footprints } from "lucide-react";
import type { HelpStep } from "@/content/help/types";
import { cn } from "@/lib/utils";
import { Rich } from "./rich";

const read = (key: string): number[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
};
const write = (key: string, v: number[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: progress just isn't remembered */
  }
};

/**
 * Interactive how-to: tick steps as you do them in Rentevent (remembered in
 * this browser), or switch to "Paso a paso" to follow one step at a time.
 */
export function HelpSteps({ steps, storageKey, next }: { steps: HelpStep[]; storageKey: string; next?: { href: string; title: string } | null }) {
  const key = `rv-help:${storageKey}`;
  const [done, setDone] = useState<number[]>([]);
  const [mode, setMode] = useState<"lista" | "guiado">("lista");
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const saved = read(key);
    // restore after hydration (server HTML has no progress)
    const t = setTimeout(() => {
      setDone(saved);
      const first = steps.findIndex((_, i) => !saved.includes(i));
      setCur(first === -1 ? 0 : first);
    }, 0);
    return () => clearTimeout(t);
  }, [key, steps]);

  const update = useCallback(
    (fn: (d: number[]) => number[]) =>
      setDone((d) => {
        const n = [...new Set(fn(d))].sort((a, b) => a - b);
        write(key, n);
        return n;
      }),
    [key],
  );
  const toggle = (i: number) => update((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const go = useCallback((i: number) => setCur(Math.max(0, Math.min(steps.length - 1, i))), [steps.length]);
  const advance = useCallback(() => {
    update((d) => [...d, cur]);
    if (cur < steps.length - 1) go(cur + 1);
  }, [cur, go, steps.length, update]);

  useEffect(() => {
    if (mode !== "guiado") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") go(cur - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, cur, advance, go]);

  const pct = Math.round((done.length / steps.length) * 100);
  const finished = done.length === steps.length;
  const s = steps[cur]!;

  return (
    <section aria-label="Pasos" className="mt-8">
      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="min-w-40 flex-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done.length} de {steps.length} pasos
            </span>
            <span className="tabular">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la guía">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex rounded-lg bg-subtle p-0.5 text-sm" role="tablist" aria-label="Modo de lectura">
          {(
            [
              ["lista", "Todos los pasos", ListOrdered],
              ["guiado", "Paso a paso", Footprints],
            ] as const
          ).map(([m, label, Icon]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1", mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        {done.length > 0 && (
          <button type="button" onClick={() => update(() => [])} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Desmarcar todos los pasos">
            <RotateCcw className="size-3.5" aria-hidden /> Reiniciar
          </button>
        )}
      </div>

      {mode === "lista" ? (
        <ol className="mt-6 space-y-3">
          {steps.map((st, i) => {
            const ok = done.includes(i);
            return (
              <li key={i} className={cn("flex gap-4 rounded-2xl border p-4 transition-colors sm:p-5", ok && "border-success/30 bg-success-bg/40")}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={ok}
                  aria-label={ok ? `Desmarcar paso ${i + 1}` : `Marcar paso ${i + 1} como hecho`}
                  className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular transition-colors", ok ? "border-success bg-success text-white" : "border-border-strong hover:border-brand-500 hover:text-brand-600")}
                >
                  {ok ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                </button>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className={cn("font-semibold", ok && "text-muted-foreground line-through decoration-1")}>{st.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                    <Rich text={st.text} />
                  </p>
                  {st.tip && (
                    <p className="mt-3 flex gap-2 rounded-xl bg-warning-bg/50 px-3 py-2 text-sm">
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      <span>
                        <Rich text={st.tip} />
                      </span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-6">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <button key={i} type="button" tabIndex={-1} onClick={() => go(i)} className={cn("h-1.5 flex-1 rounded-full transition-colors", i === cur ? "bg-brand-500" : done.includes(i) ? "bg-success" : "bg-subtle")} />
            ))}
          </div>
          <article key={cur} className="mt-5 rounded-3xl border p-6 shadow-sm animate-in fade-in slide-in-from-right-2 duration-300 sm:p-8" aria-live="polite">
            <p className="text-sm font-medium text-brand-700">
              Paso {cur + 1} de {steps.length}
            </p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">{s.title}</h3>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              <Rich text={s.text} />
            </p>
            {s.tip && (
              <p className="mt-5 flex gap-2 rounded-xl bg-warning-bg/50 px-4 py-3">
                <Lightbulb className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <span>
                  <Rich text={s.tip} />
                </span>
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0} className="flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-40">
                <ArrowLeft className="size-4" aria-hidden /> Anterior
              </button>
              <span className="hidden text-xs text-muted-foreground sm:block">Usa ← y → del teclado</span>
              {cur < steps.length - 1 || !done.includes(cur) ? (
                <button type="button" onClick={advance} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                  {cur < steps.length - 1 ? "Hecho, siguiente" : "Terminar"} <ArrowRight className="size-4" aria-hidden />
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <Check className="size-4" aria-hidden /> Último paso hecho
                </span>
              )}
            </div>
          </article>
        </div>
      )}

      {finished && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-success-bg/60 px-5 py-4 animate-in fade-in duration-300">
          <p className="flex items-center gap-2 font-medium">
            <Check className="size-5 text-success" aria-hidden /> Has completado esta guía.
          </p>
          {next && (
            <Link href={next.href} className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              Siguiente: {next.title} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
