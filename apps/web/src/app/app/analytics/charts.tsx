import { formatEUR, formatNumber } from "@/lib/utils";

const MONTH = new Intl.DateTimeFormat("es-ES", { month: "short" });
export const monthLabel = (mk: string) => {
  const [y, m] = mk.split("-").map(Number) as [number, number];
  return `${MONTH.format(new Date(Date.UTC(y, m - 1, 15))).replace(".", "")} ${String(y).slice(2)}`;
};

/** Vertical bars with an optional second (lighter) series. */
export function BarChart({ data, label, money = true }: { data: { key: string; value: number; secondary?: number }[]; label: string; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)));
  const W = Math.max(320, data.length * 56);
  const Hh = 200;
  const bw = Math.min(36, (W / data.length) * 0.6);
  const f = (n: number) => (money ? formatEUR(n) : formatNumber(n));
  return (
    <figure className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${Hh + 40}`} className="h-auto w-full min-w-[480px]" preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={Hh - Hh * t} y2={Hh - Hh * t} stroke="var(--border)" strokeDasharray="3 4" />
        ))}
        {data.map((d, i) => {
          const cx = (i + 0.5) * (W / data.length);
          const h = (d.value / max) * Hh;
          const h2 = d.secondary != null ? (d.secondary / max) * Hh : 0;
          return (
            <g key={d.key}>
              <title>{`${monthLabel(d.key)}: ${f(d.value)}${d.secondary != null ? ` · ${f(d.secondary)}` : ""}`}</title>
              {d.secondary != null && <rect x={cx - bw / 2 - 4} y={Hh - h2} width={bw} height={h2} rx={3} fill="var(--border-strong)" />}
              <rect x={cx - bw / 2 + (d.secondary != null ? 4 : 0)} y={Hh - h} width={bw} height={Math.max(h, d.value > 0 ? 1 : 0)} rx={3} fill="var(--brand-500)" />
              <text x={cx} y={Hh + 16} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{monthLabel(d.key)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export function HBars({ data, money = true }: { data: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={d.label}>{d.label}</span>
          <span className="h-2.5 rounded-full bg-subtle">
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="tabular text-right text-muted-foreground">{money ? formatEUR(d.value) : formatNumber(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function heat(v: number) {
  if (v >= 85) return "bg-danger-bg text-danger";
  if (v >= 60) return "bg-warning-bg text-warning";
  if (v > 0) return "bg-success-bg text-success";
  return "bg-subtle text-muted-foreground";
}

export function HeatTable({ months, rows }: { months: string[]; rows: { family: string; truss: string; values: number[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr>
            <th className="py-2 pr-3 text-left font-normal text-muted-foreground">Familia</th>
            {months.map((m) => (
              <th key={m} className="px-0.5 py-2 text-center font-normal text-muted-foreground">{monthLabel(m)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.family}>
              <td className="whitespace-nowrap py-0.5 pr-3 text-[13px]">
                {r.family} <span className="text-muted-foreground">· {r.truss}</span>
              </td>
              {r.values.map((v, i) => (
                <td key={i} className="p-0.5">
                  <div className={`tabular flex h-8 items-center justify-center rounded ${heat(v)}`} title={`${v} % de ocupación media`}>{v > 0 ? `${Math.round(v)}%` : "·"}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
