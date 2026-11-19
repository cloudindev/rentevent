import { Clock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { ClockPanel } from "@/components/crew/clock-panel";
import { formatDate, formatTime } from "@/lib/utils";
import { workedHours } from "@/server/crew/hours";
import { mobileContext, myAgenda, recentEntries } from "@/server/crew/mobile";

export const metadata = { title: "Fichar" };

export default async function ClockPage() {
  const { ctx, worker } = await mobileContext();
  if (!worker) return <EmptyState icon={Clock} title="Sin ficha de trabajador" description="Tu usuario no está vinculado a una ficha. Pide a tu responsable que lo vincule para poder fichar." />;
  const now = new Date();
  const { rows, open } = await myAgenda(ctx.tenantId, worker.id, new Date(now.getTime() - 14 * 3_600_000), new Date(now.getTime() + 14 * 3_600_000));
  const entries = await recentEntries(ctx.tenantId, worker.id);
  const openShift = open?.shiftId ? rows.find((r) => r.s.id === open.shiftId) : null;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Fichar</h1>
      <ClockPanel
        open={open ? { clockIn: open.clockIn.toISOString(), shiftTitle: openShift?.project ?? openShift?.s.title ?? null } : null}
        todayShifts={rows.filter((r) => r.status !== "rechazado").map((r) => ({ id: r.s.id, label: `${formatTime(r.s.startsAt)} · ${r.project ?? r.s.title}` }))}
      />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Últimos fichajes</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no has fichado.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="capitalize">{formatDate(e.clockIn, { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className="tabular text-muted-foreground">
                  {formatTime(e.clockIn)} – {e.clockOut ? formatTime(e.clockOut) : "…"}
                </span>
                <span className="tabular font-medium">{workedHours(e).toFixed(2)} h</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
