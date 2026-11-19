import { cn } from "@/lib/utils";

export type TimelineData = {
  days: { day: string; start: number; end: number; label: string; tag?: string }[];
  rows: { key: string; label: string; kind: "proyecto" | "este" | "subalquiler"; status?: string; spans: { start: number; end: number; quantity: number }[] }[];
  cells: { day: string; available: number }[];
  total: number;
};

const STATUS_STYLE: Record<string, string> = {
  confirmado: "border-border-strong bg-background",
  opcion: "border-warning/40 bg-warning-bg text-warning",
  consulta: "border-dashed border-border-strong bg-background text-muted-foreground",
};

/**
 * Per-item availability timeline: one row per occupying order, "Este pedido",
 * "Subalquiler" and a final "Libres" row with the balance per day (green, red
 * or neutral), including prep and return days.
 */
export function ItemTimeline({ data, title, subtitle }: { data: TimelineData; title: string; subtitle?: string }) {
  const n = data.days.length;
  const t0 = data.days[0]?.start ?? 0;
  const t1 = data.days[n - 1]?.end ?? 1;
  const pos = (t: number) => Math.min(100, Math.max(0, ((t - t0) / (t1 - t0)) * 100));
  return (
    <section className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-5" aria-label={`Línea de tiempo de ${title}`}>
      <header className="mb-3 flex items-baseline gap-3">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </header>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid items-end" style={{ gridTemplateColumns: `140px repeat(${n}, minmax(0,1fr))` }}>
            <span />
            {data.days.map((d) => (
              <span key={d.day} className="truncate px-1 pb-2 text-[12px] text-muted-foreground">
                {d.label}
                {d.tag && <span className="text-foreground/60"> · {d.tag}</span>}
              </span>
            ))}
          </div>
          {data.rows.map((r) => (
            <div key={r.key} className="grid items-center" style={{ gridTemplateColumns: `140px minmax(0,1fr)` }}>
              <span className={cn("truncate py-1.5 pr-2 text-[13px]", r.kind === "este" ? "text-foreground" : "text-muted-foreground")} title={r.label}>
                {r.label}
              </span>
              <div className="relative h-8">
                {r.spans.map((s, i) => {
                  const left = pos(s.start);
                  const width = Math.max(2, pos(s.end) - left);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "absolute top-1 flex h-6 items-center truncate rounded-full border px-3 text-[12px]",
                        r.kind === "este" ? "border-brand-300 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : r.kind === "subalquiler" ? "border-info/30 bg-info-bg text-info" : STATUS_STYLE[r.status ?? "confirmado"],
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${s.quantity} uds`}
                    >
                      {s.quantity} uds{r.kind === "proyecto" ? ` · ${r.label}` : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-2 grid items-center gap-1" style={{ gridTemplateColumns: `140px repeat(${n}, minmax(0,1fr))` }}>
            <span className="text-[13px] font-medium">Libres</span>
            {data.cells.map((c) => (
              <span
                key={c.day}
                className={cn(
                  "tabular flex h-9 items-center justify-center rounded-md text-sm",
                  c.available < 0 ? "bg-danger-bg text-danger" : c.available < data.total ? "bg-success-bg text-success" : "bg-subtle text-foreground/70",
                )}
              >
                {c.available}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
