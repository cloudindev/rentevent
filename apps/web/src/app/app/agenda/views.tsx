import Link from "next/link";
import { cn } from "@/lib/utils";

export type AgendaEvent = { id: string; kind: "pedido" | "fase" | "turno" | "transporte"; title: string; subtitle: string; start: string; end: string; color: string; href: string };
type Day = { day: string; start: number; end: number };

const TIME = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
const WD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function overlaps(e: AgendaEvent, d: Day) {
  return new Date(e.start).getTime() < d.end && new Date(e.end).getTime() > d.start;
}

export function AgendaViews({ view, days, anchorMonth, events, today, dayHref }: { view: "dia" | "semana" | "mes"; days: Day[]; anchorMonth: string; events: AgendaEvent[]; today: string; dayHref: (d: string) => string }) {
  if (view === "mes") {
    const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
    return (
      <div className="p-4 md:p-6">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-subtle text-xs text-muted-foreground">
            {WD.map((w) => <div key={w} className="px-2 py-2">{w}</div>)}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-0">
              {week.map((d) => {
                const evs = events.filter((e) => overlaps(e, d)).sort((a, b) => (a.kind === "pedido" ? -1 : 1) - (b.kind === "pedido" ? -1 : 1) || a.start.localeCompare(b.start));
                return (
                  <div key={d.day} className={cn("min-h-28 border-r p-1.5 last:border-0", !d.day.startsWith(anchorMonth) && "bg-subtle/60")}>
                    <Link href={dayHref(d.day)} className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", d.day === today ? "bg-primary font-semibold text-white" : "text-muted-foreground hover:bg-accent")}>
                      {Number(d.day.slice(8))}
                    </Link>
                    <div className="space-y-0.5">
                      {evs.slice(0, 4).map((e) => (
                        <Link key={e.id} href={e.href} title={`${e.title} · ${e.subtitle}`} className="block truncate rounded px-1.5 py-0.5 text-[11px] leading-4 text-white hover:opacity-90" style={{ background: e.color }}>
                          {e.title}
                        </Link>
                      ))}
                      {evs.length > 4 && <Link href={dayHref(d.day)} className="block px-1 text-[11px] text-muted-foreground hover:underline">+{evs.length - 4} más</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const H0 = 6;
  const H1 = 24;
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
  const pos = (t: number, d: Day) => {
    const h = (t - d.start) / 3_600_000;
    return Math.min(100, Math.max(0, ((h - H0) / (H1 - H0)) * 100));
  };
  return (
    <div className="p-4 md:p-6">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          <div className="border-b border-r bg-subtle" />
          {days.map((d, i) => (
            <Link key={d.day} href={dayHref(d.day)} className={cn("border-b border-r bg-subtle px-2 py-2 text-xs last:border-r-0", d.day === today && "font-semibold text-primary")}>
              {WD[i % 7] && days.length > 1 ? WD[i % 7] : ""} {Number(d.day.slice(8))}
            </Link>
          ))}
          <div className="border-b border-r px-1 py-1 text-right text-[10px] text-muted-foreground">Varios días</div>
          {days.map((d) => {
            const allDay = events.filter((e) => overlaps(e, d) && new Date(e.end).getTime() - new Date(e.start).getTime() > 20 * 3_600_000);
            return (
              <div key={`ad-${d.day}`} className="max-h-40 space-y-0.5 overflow-y-auto border-b border-r p-1 last:border-r-0">
                {allDay.map((e) => (
                  <Link key={e.id} href={e.href} className="block truncate rounded px-1.5 py-0.5 text-[11px] text-white" style={{ background: e.color }} title={e.subtitle}>{e.title}</Link>
                ))}
              </div>
            );
          })}
          <div className="relative border-r">
            {hours.map((h) => <div key={h} className="h-12 border-b pr-1 text-right text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}:00</div>)}
          </div>
          {days.map((d) => {
            const evs = events.filter((e) => overlaps(e, d));
            const allDay = evs.filter((e) => new Date(e.end).getTime() - new Date(e.start).getTime() > 20 * 3_600_000);
            const timed = evs.filter((e) => !allDay.includes(e));
            return (
              <div key={d.day} className="relative border-r last:border-r-0" style={{ height: hours.length * 48 }}>
                {hours.map((h) => <div key={h} className="h-12 border-b" />)}
                {timed.map((e, i) => {
                  const top = pos(Math.max(new Date(e.start).getTime(), d.start), d);
                  const bottom = pos(Math.min(new Date(e.end).getTime(), d.end), d);
                  return (
                    <Link key={e.id} href={e.href} className="absolute overflow-hidden rounded-md border-l-4 bg-background px-1.5 py-1 text-[11px] shadow-sm hover:z-10 hover:shadow" style={{ top: `${top}%`, height: `${Math.max(4, bottom - top)}%`, left: `${4 + (i % 3) * 6}%`, right: "4px", borderLeftColor: e.color }} title={`${e.title} · ${e.subtitle}`}>
                      <span className="block truncate font-medium">{e.title}</span>
                      <span className="block truncate text-muted-foreground">{TIME.format(new Date(e.start))}–{TIME.format(new Date(e.end))} · {e.subtitle}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
