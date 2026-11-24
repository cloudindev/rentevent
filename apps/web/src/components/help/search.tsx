"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import type { HelpSearchEntry } from "@/content/help";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\*\*/g, "").toLowerCase();

/** Snippet around the first match, for the result list. */
function snippet(text: string, terms: string[]) {
  const t = text.replace(/\*\*/g, "");
  const n = norm(t);
  const at = Math.min(...terms.map((x) => n.indexOf(x)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return t.slice(0, 140);
  const from = Math.max(0, at - 50);
  return `${from ? "…" : ""}${t.slice(from, from + 150)}…`;
}

export function HelpSearch({ entries, autoFocus, className }: { entries: HelpSearchEntry[]; autoFocus?: boolean; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const prepared = useMemo(() => entries.map((e) => ({ ...e, nt: norm(e.title), nx: norm(e.text) })), [entries]);
  const terms = norm(q).split(/\s+/).filter((t) => t.length > 1);
  const results = useMemo(() => {
    if (!terms.length) return [];
    return prepared
      .map((e) => {
        if (!terms.every((t) => e.nt.includes(t) || e.nx.includes(t))) return null;
        const score = terms.reduce((s, t) => s + (e.nt.includes(t) ? 10 : 0) + (e.nx.split(t).length - 1), 0) + (e.area === "Área" ? 3 : 0);
        return { e, score };
      })
      .filter((x) => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, q]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        ev.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={input}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              router.push(results[active].e.href);
            } else if (e.key === "Escape") setQ("");
          }}
          placeholder="Busca una tarea: crear un pedido, reglas de despiece, escanear una caja…"
          aria-label="Buscar en la ayuda"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="help-results"
          className="h-14 w-full rounded-2xl border bg-background pl-12 pr-12 text-base shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
        />
        <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border bg-subtle px-1.5 py-0.5 text-xs text-muted-foreground sm:block">/</kbd>
      </div>
      {terms.length > 0 && (
        <div id="help-results" role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-background text-left shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">No hay resultados para «{q}». Prueba con otra palabra o recorre las áreas de abajo.</p>
          ) : (
            <ul>
              {results.map(({ e }, i) => (
                <li key={e.href} role="option" aria-selected={i === active}>
                  <Link href={e.href} onMouseEnter={() => setActive(i)} className={cn("flex items-start gap-3 px-4 py-3", i === active && "bg-subtle")}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{e.title}</span>
                      <span className="mt-0.5 block text-xs text-brand-700">{e.area === "Área" ? "Área completa" : e.area}</span>
                      <span className="mt-1 line-clamp-2 block text-[13px] text-muted-foreground">{snippet(e.text, terms)}</span>
                    </span>
                    {i === active && <CornerDownLeft className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
