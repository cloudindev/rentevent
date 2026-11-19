import { Tent } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { weeklyOccupancy } from "@/server/occupancy";
import { formatDate } from "@/lib/utils";
import { CarpasTabs } from "../tabs";
import { ReverseQuery } from "./reverse-query";

export const metadata = { title: "Ocupación de cerchas" };

function heat(pct: number) {
  if (pct >= 100) return "bg-danger text-white dark:text-black";
  if (pct >= 85) return "bg-danger-bg text-danger";
  if (pct >= 60) return "bg-warning-bg text-warning";
  if (pct > 0) return "bg-success-bg text-success";
  return "bg-subtle text-muted-foreground";
}

export default async function OccupancyPage() {
  const { cat, occ } = await tenantDb(async (tx) => {
    const cat = await loadCatalog(tx);
    const trusses = cat.items.filter((i) => i.role === "cercha" || i.role === "jaima");
    const occ = await weeklyOccupancy(tx, trusses.map((t) => t.id), new Map(trusses.map((t) => [t.id, { total: t.stockTotal, repair: t.stockRepair }])));
    return { cat, occ };
  });
  const trusses = cat.items.filter((i) => i.role === "cercha" || i.role === "jaima");
  return (
    <>
      <PageHeader icon={Tent} title="Carpas" />
      <CarpasTabs />
      <PageBody>
        <ReverseQuery />
        <section className="overflow-x-auto rounded-xl border bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Ocupación de cerchas por semana</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-3 rounded bg-success-bg" /> &lt; 60 %</span>
              <span className="flex items-center gap-1"><span className="size-3 rounded bg-warning-bg" /> 60–85 %</span>
              <span className="flex items-center gap-1"><span className="size-3 rounded bg-danger-bg" /> &gt; 85 %</span>
              <span className="flex items-center gap-1"><span className="size-3 rounded bg-danger" /> lleno</span>
            </div>
          </div>
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-y bg-subtle">
                <th className="px-4 py-2 text-left font-normal text-muted-foreground">Cercha</th>
                {occ.weeks.map((w) => (
                  <th key={w.week} className="px-1 py-2 text-center font-normal text-muted-foreground">
                    {formatDate(w.start, { day: "numeric", month: "short" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trusses.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className="font-medium">{t.sku}</span> <span className="text-muted-foreground">· {t.stockTotal - t.stockRepair} uds</span>
                  </td>
                  {occ.byItem.get(t.id)!.map((c) => (
                    <td key={c.week} className="p-0.5">
                      <div className={`tabular flex h-8 items-center justify-center rounded ${heat(c.pct)}`} title={`Reservadas ${c.reserved} · opciones ${c.option} · libres ${c.available}`}>
                        {c.pct > 0 ? `${c.pct}%` : "·"}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </PageBody>
    </>
  );
}
