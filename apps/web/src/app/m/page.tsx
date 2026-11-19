import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin, Truck } from "lucide-react";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ASSIGNMENT_LABEL, ASSIGNMENT_TONE } from "@/components/crew/bits";
import { RespondButtons } from "@/components/crew/respond-buttons";
import { formatDate, formatTime } from "@/lib/utils";
import { madridDay } from "@/server/crew/hours";
import { mobileContext, myAgenda } from "@/server/crew/mobile";

export const metadata = { title: "Mi agenda" };

export default async function AgendaPage() {
  const { ctx, worker } = await mobileContext();
  if (!worker)
    return (
      <EmptyState
        icon={CalendarDays}
        title="Tu usuario no tiene ficha de trabajador"
        description="Pide a tu responsable que vincule tu usuario a tu ficha en Personal para ver tu agenda y fichar."
        action={ctx.role !== "montador" ? <Link className="text-sm text-link underline" href="/app/inicio">Ir a la aplicación</Link> : undefined}
      />
    );
  const now = new Date();
  const from = new Date(now.getTime() - 12 * 3_600_000);
  const to = new Date(now.getTime() + 21 * 86_400_000);
  const { rows, reports, open } = await myAgenda(ctx.tenantId, worker.id, from, to);
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = madridDay(r.s.startsAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const today = madridDay(now);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Hola, {worker.name.split(" ")[0]}</p>
        <h1 className="text-xl font-semibold">Mi agenda</h1>
      </div>
      {open && (
        <Link href="/m/fichar" className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-bg px-4 py-3 text-sm text-success">
          <span className="size-2 animate-pulse rounded-full bg-success" /> Jornada en curso desde las {formatTime(open.clockIn)}
          <ChevronRight className="ml-auto size-4" />
        </Link>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No tienes turnos publicados" description="Cuando se publique el planning verás aquí tus montajes de las próximas semanas." />
      ) : (
        [...groups.entries()].map(([day, list]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-sm font-semibold capitalize">{day === today ? "Hoy" : formatDate(list[0]!.s.startsAt, { weekday: "long", day: "numeric", month: "long" })}</h2>
            {list.map(({ s, status, project, vehicle }) => {
              const done = reports.find((r) => r.shiftId === s.id)?.completedAt;
              return (
                <article key={s.id} className="rounded-xl border bg-background p-4">
                  <Link href={`/m/turno/${s.id}`} className="block">
                    <div className="flex items-center gap-2">
                      <span className="tabular text-sm font-semibold">
                        {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                      </span>
                      <StatusPill tone="brand" dot={false}>
                        {PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind}
                      </StatusPill>
                      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                    </div>
                    <p className="mt-1 font-medium">{project ?? s.title}</p>
                    {s.address && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {s.address}
                      </p>
                    )}
                    {vehicle && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Truck className="size-3.5" /> {vehicle}
                      </p>
                    )}
                  </Link>
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <StatusPill tone={ASSIGNMENT_TONE[status] ?? "neutral"}>{ASSIGNMENT_LABEL[status] ?? status}</StatusPill>
                    {done && <StatusPill tone="success">Parte enviado</StatusPill>}
                    <div className="ml-auto">{s.endsAt > now && <RespondButtons shiftId={s.id} status={status} />}</div>
                  </div>
                </article>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
