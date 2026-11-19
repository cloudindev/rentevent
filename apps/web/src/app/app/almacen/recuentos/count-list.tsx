"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { formatDate, formatNumber } from "@/lib/utils";
import { recordCount } from "@/server/actions/inventory";

type Row = { id: string; sku: string; name: string; category: string; location: string | null; unit: string; stockTotal: number; lastCount: string | null; ageDays: number | null; lastDiff: number | null };

export function CountList({ rows, canCount, staleDays }: { rows: Row[]; canCount: boolean; staleDays: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [apply, setApply] = useState(true);
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? rows.filter((r) => `${r.name} ${r.sku} ${r.location ?? ""}`.toLowerCase().includes(n)) : rows;
  }, [rows, q]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar artículo o ubicación…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar artículo" />
        </div>
        {canCount && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={apply} onCheckedChange={setApply} /> Ajustar el stock con la diferencia
          </label>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-subtle text-[13px] text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-4 text-left font-normal">Artículo</th>
              <th className="px-3 text-left font-normal">Ubicación</th>
              <th className="px-3 text-right font-normal">En sistema</th>
              <th className="px-3 text-left font-normal">Último recuento</th>
              <th className="px-3 text-right font-normal">Contado</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const v = counted[r.id] ?? "";
              const diff = v === "" ? null : Number(v) - r.stockTotal;
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-subtle">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{r.name}</span> <span className="font-mono text-[11px] text-muted-foreground">{r.sku}</span>
                  </td>
                  <td className="px-3">{r.location ?? "—"}</td>
                  <td className="tabular px-3 text-right">{formatNumber(r.stockTotal)}</td>
                  <td className="px-3">
                    {r.lastCount ? (
                      <span className="flex items-center gap-2">
                        {formatDate(r.lastCount)}
                        {r.ageDays != null && r.ageDays >= staleDays && <StatusPill tone="warning">{r.ageDays} d</StatusPill>}
                        {r.lastDiff ? <span className="text-xs text-muted-foreground">({r.lastDiff > 0 ? "+" : ""}{formatNumber(r.lastDiff)})</span> : null}
                      </span>
                    ) : (
                      <StatusPill tone="warning">Nunca</StatusPill>
                    )}
                  </td>
                  <td className="px-3 text-right">
                    <input
                      type="number"
                      min={0}
                      aria-label={`Unidades contadas de ${r.name}`}
                      disabled={!canCount}
                      value={v}
                      onChange={(e) => setCounted((c) => ({ ...c, [r.id]: e.target.value }))}
                      className="tabular h-8 w-20 rounded-md border bg-background px-2 text-right"
                    />
                    {diff != null && diff !== 0 && <span className={`ml-2 text-xs ${diff < 0 ? "text-danger" : "text-success"}`}>{diff > 0 ? "+" : ""}{formatNumber(diff)}</span>}
                  </td>
                  <td className="pr-3 text-right">
                    {canCount && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || v === ""}
                        onClick={() =>
                          start(async () => {
                            const res = await recordCount({ itemId: r.id, counted: Number(v), apply });
                            if (!res.ok) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(res.data.diff === 0 ? `${r.name}: correcto` : `${r.name}: diferencia ${res.data.diff > 0 ? "+" : ""}${res.data.diff}`);
                            setCounted((c) => ({ ...c, [r.id]: "" }));
                            router.refresh();
                          })
                        }
                      >
                        Registrar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Ningún artículo coincide.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
