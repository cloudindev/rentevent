import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dayCells, dayKey, parseDayKey, PHASE_LABELS, zonedTime, type PhaseKind } from "@rentevent/core";
import { and, eq, gt, lt, orders, projectPhases, projects, shifts, contacts, vehicles, assignments, workers, inArray } from "@rentevent/db";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { STATUS_COLOR, ORDER_STATUS } from "@/components/app/order-status";
import { tenantDb } from "@/server/context";
import { cn } from "@/lib/utils";
import { AgendaViews, type AgendaEvent } from "./views";

export const metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";

function rangeFor(view: View, anchor: string) {
  const [y, m, d] = parseDayKey(anchor);
  if (view === "dia") return { from: anchor, to: anchor };
  if (view === "semana") {
    const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const from = addDays(anchor, -dow);
    return { from, to: addDays(from, 6) };
  }
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const dow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const from = addDays(first, -dow);
  return { from, to: addDays(from, 41) };
}

function shiftAnchor(view: View, anchor: string, dir: -1 | 1) {
  if (view === "dia") return addDays(anchor, dir);
  if (view === "semana") return addDays(anchor, 7 * dir);
  const [y, m] = parseDayKey(anchor);
  const nm = new Date(Date.UTC(y, m - 1 + dir, 1));
  return nm.toISOString().slice(0, 10);
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string; fecha?: string; tipos?: string }> }) {
  const sp = await searchParams;
  const view: View = sp.vista === "dia" || sp.vista === "semana" ? sp.vista : "mes";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : dayKey(Date.now());
  const types = new Set((sp.tipos ?? "pedidos,fases,turnos,transporte").split(","));
  const { from, to } = rangeFor(view, anchor);
  const [fy, fm, fd] = parseDayKey(from);
  const [ty, tm, td] = parseDayKey(addDays(to, 1));
  const start = new Date(zonedTime(fy, fm, fd));
  const end = new Date(zonedTime(ty, tm, td));

  const events = await tenantDb(async (tx) => {
    const out: AgendaEvent[] = [];
    if (types.has("pedidos")) {
      const os = await tx.select({ id: orders.id, number: orders.number, title: orders.title, status: orders.status, s: orders.periodStart, e: orders.periodEnd, client: contacts.name }).from(orders).leftJoin(contacts, eq(contacts.id, orders.clientId)).where(and(lt(orders.periodStart, end), gt(orders.periodEnd, start)));
      for (const o of os) if (o.status !== "cancelado") out.push({ id: `o-${o.id}`, kind: "pedido", title: `${o.number} · ${o.title}`, subtitle: `${ORDER_STATUS[o.status]?.label ?? o.status}${o.client ? ` · ${o.client}` : ""}`, start: o.s.toISOString(), end: o.e.toISOString(), color: STATUS_COLOR[o.status] ?? "#6b6b68", href: `/app/pedidos/${o.id}` });
    }
    if (types.has("fases")) {
      const ph = await tx.select({ id: projectPhases.id, kind: projectPhases.kind, s: projectPhases.startsAt, e: projectPhases.endsAt, pid: projects.id, name: projects.name, status: projects.status }).from(projectPhases).innerJoin(projects, eq(projects.id, projectPhases.projectId)).where(and(lt(projectPhases.startsAt, end), gt(projectPhases.endsAt, start), inArray(projectPhases.kind, ["montaje", "evento", "desmontaje"])));
      for (const p of ph) if (p.status !== "cancelado") out.push({ id: `f-${p.id}`, kind: "fase", title: `${PHASE_LABELS[p.kind as PhaseKind]} · ${p.name}`, subtitle: "Fase de proyecto", start: p.s.toISOString(), end: p.e.toISOString(), color: p.kind === "evento" ? "#15803d" : p.kind === "montaje" ? "#e5412a" : "#9c2b1e", href: `/app/proyectos/${p.pid}` });
    }
    if (types.has("turnos") || types.has("transporte")) {
      const sh = await tx.select({ id: shifts.id, title: shifts.title, kind: shifts.phaseKind, s: shifts.startsAt, e: shifts.endsAt, need: shifts.requiredPeople, vehicle: vehicles.name }).from(shifts).leftJoin(vehicles, eq(vehicles.id, shifts.vehicleId)).where(and(lt(shifts.startsAt, end), gt(shifts.endsAt, start)));
      const asg = sh.length ? await tx.select({ shiftId: assignments.shiftId, name: workers.name }).from(assignments).innerJoin(workers, eq(workers.id, assignments.workerId)).where(inArray(assignments.shiftId, sh.map((s) => s.id))) : [];
      for (const s of sh) {
        const isTransport = s.kind === "transporte" || s.kind === "retorno" || Boolean(s.vehicle);
        if (isTransport && types.has("transporte")) out.push({ id: `v-${s.id}`, kind: "transporte", title: `${s.vehicle ?? "Transporte"} · ${s.title}`, subtitle: asg.filter((a) => a.shiftId === s.id).map((a) => a.name).join(", ") || "Sin conductor", start: s.s.toISOString(), end: s.e.toISOString(), color: "#2c5fb3", href: "/app/transporte" });
        if (types.has("turnos")) {
          const team = asg.filter((a) => a.shiftId === s.id);
          out.push({ id: `t-${s.id}`, kind: "turno", title: s.title, subtitle: `${team.length}/${s.need} · ${team.map((a) => a.name.split(" ")[0]).join(", ") || "sin asignar"}`, start: s.s.toISOString(), end: s.e.toISOString(), color: team.length >= s.need ? "#6b6b68" : "#a35a06", href: "/app/personal/tablero" });
        }
      }
    }
    return out;
  });

  const title = new Intl.DateTimeFormat("es-ES", view === "mes" ? { month: "long", year: "numeric" } : view === "semana" ? { day: "numeric", month: "short" } : { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${anchor}T12:00:00Z`));
  const q = (p: Record<string, string>) => `/app/agenda?${new URLSearchParams({ vista: view, fecha: anchor, tipos: [...types].join(","), ...p }).toString()}`;
  const allTypes = [["pedidos", "Pedidos"], ["fases", "Fases"], ["turnos", "Turnos"], ["transporte", "Transporte"]] as const;
  return (
    <>
      <PageHeader icon={CalendarDays} title="Agenda" subtitle={view === "semana" ? `Semana del ${title}` : title}>
        <div className="flex items-center gap-1">
          <Button asChild size="icon-sm" variant="outline"><Link href={q({ fecha: shiftAnchor(view, anchor, -1) })} aria-label="Anterior"><ChevronLeft /></Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={q({ fecha: dayKey(Date.now()) })}>Hoy</Link></Button>
          <Button asChild size="icon-sm" variant="outline"><Link href={q({ fecha: shiftAnchor(view, anchor, 1) })} aria-label="Siguiente"><ChevronRight /></Link></Button>
        </div>
        <div className="flex rounded-lg border p-0.5">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <Link key={v} href={q({ vista: v })} className={cn("rounded-md px-2.5 py-1 text-sm", v === view ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}>
              {v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}
            </Link>
          ))}
        </div>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 md:px-6">
        {allTypes.map(([k, l]) => {
          const on = types.has(k);
          const next = new Set(types);
          if (on) next.delete(k);
          else next.add(k);
          return (
            <Link key={k} href={q({ tipos: [...next].join(",") || "pedidos" })} className={cn("rounded-full border px-3 py-1 text-xs", on ? "border-foreground/30 bg-accent font-medium" : "text-muted-foreground")} aria-pressed={on}>
              {l}
            </Link>
          );
        })}
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {["consulta", "opcion", "confirmado", "en_curso"].map((s) => (
            <span key={s} className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} /> {ORDER_STATUS[s]?.label}</span>
          ))}
        </span>
      </div>
      <AgendaViews view={view} days={dayCells(from, to).map((d) => ({ day: d.day, start: d.start, end: d.end }))} anchorMonth={anchor.slice(0, 7)} events={events} today={dayKey(Date.now())} dayHref={(d) => q({ vista: "dia", fecha: d })} />
    </>
  );
}
