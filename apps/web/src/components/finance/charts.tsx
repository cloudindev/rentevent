import { formatEUR } from "@/lib/utils";

const compact = (n: number) => new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Monthly bars (pure SVG, server-rendered). */
export function BarChart({ data, height = 180, highlightLast = true }: { data: { label: string; value: number }[]; height?: number; highlightLast?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 640;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const bw = (w - pad.l - pad.r) / Math.max(1, data.length);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const y = (v: number) => pad.t + (height - pad.t - pad.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label="Facturación mensual">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t === 0 ? undefined : "3 3"} />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {compact(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 2 : 0, height - pad.t - pad.b - (y(d.value) - pad.t));
        const last = highlightLast && i === data.length - 1;
        return (
          <g key={d.label + i}>
            <title>{`${d.label}: ${formatEUR(d.value)}`}</title>
            <rect x={pad.l + i * bw + bw * 0.18} y={height - pad.b - h} width={bw * 0.64} height={h} rx={3} className={last ? "fill-brand-500" : "fill-foreground/15"} />
            <text x={pad.l + i * bw + bw / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Balance line with area, zero line and min marker (pure SVG). */
export function BalanceChart({ points, height = 200, width = 640 }: { points: { date: string; balance: number }[]; height?: number; width?: number }) {
  if (points.length === 0) return null;
  const w = width;
  const pad = { l: 52, r: 10, t: 12, b: 24 };
  const vals = points.map((p) => p.balance);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);
  const span = max - min || 1;
  const x = (i: number) => pad.l + ((w - pad.l - pad.r) * i) / Math.max(1, points.length - 1);
  const y = (v: number) => pad.t + (height - pad.t - pad.b) * (1 - (v - min) / span);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  const minIdx = vals.indexOf(Math.min(...vals));
  const fmtDay = (d: string) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const labelIdx = [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label="Previsión de saldo">
      {[min, (min + max) / 2, max].map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {compact(t)}
          </text>
        </g>
      ))}
      {min < 0 && <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} className="stroke-danger" />}
      <path d={area} className="fill-brand-500/10" />
      <path d={line} className="fill-none stroke-brand-600" strokeWidth={2} />
      <circle cx={x(minIdx)} cy={y(vals[minIdx]!)} r={3.5} className={vals[minIdx]! < 0 ? "fill-danger" : "fill-brand-600"}>
        <title>{`Mínimo ${formatEUR(vals[minIdx]!)} · ${fmtDay(points[minIdx]!.date)}`}</title>
      </circle>
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[10px]">
          {fmtDay(points[i]!.date)}
        </text>
      ))}
    </svg>
  );
}
