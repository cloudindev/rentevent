import { notFound } from "next/navigation";
import { HardHat } from "lucide-react";
import { and, asc, assignments, desc, eq, gte, lt, member, projects, shifts, timeEntries, user, workerUnavailability, workers } from "@rentevent/db";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PersonalTabs } from "@/components/crew/personal-tabs";
import { ASSIGNMENT_LABEL, ASSIGNMENT_TONE, SkillChips, TrainingPill, WORKER_TYPE_LABELS, WorkerDot } from "@/components/crew/bits";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, canSeeField } from "@/lib/permissions";
import { formatDate, formatDateTime, formatEUR, formatTime } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { aggregateDays, nowMs, workedHours } from "@/server/crew/hours";
import { AbsencesCard, LinkUserCard } from "./client";

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const data = await tenantDb(async (tx, ctx) => {
    const [w] = await tx.select().from(workers).where(eq(workers.id, id));
    if (!w) return null;
    const [unav, asg, entries, members] = await Promise.all([
      tx.select().from(workerUnavailability).where(eq(workerUnavailability.workerId, id)).orderBy(desc(workerUnavailability.startsAt)),
      tx
        .select({ a: assignments, s: shifts, project: projects.name })
        .from(assignments)
        .innerJoin(shifts, eq(shifts.id, assignments.shiftId))
        .leftJoin(projects, eq(projects.id, shifts.projectId))
        .where(and(eq(assignments.workerId, id), gte(shifts.startsAt, new Date(nowMs() - 60 * 86_400_000))))
        .orderBy(desc(shifts.startsAt))
        .limit(60),
      tx.select().from(timeEntries).where(and(eq(timeEntries.workerId, id), gte(timeEntries.clockIn, monthStart))).orderBy(asc(timeEntries.clockIn)),
      tx.select({ id: user.id, name: user.name, email: user.email }).from(member).innerJoin(user, eq(user.id, member.userId)),
    ]);
    return { w, unav, asg, entries, members, ctx };
  });
  if (!data) notFound();
  const { w, ctx } = data;
  const showCost = canSeeField(ctx.role, "coste_hora", ctx.fieldPermissions);
  const canEdit = can(ctx.role, "personal");
  const monthShifts = data.asg.filter((x) => x.s.startsAt >= monthStart && x.a.status !== "rechazado");
  const days = aggregateDays(
    data.entries.map((e) => ({ workerId: e.workerId, clockIn: e.clockIn, clockOut: e.clockOut, breakMinutes: e.breakMinutes, diet: e.diet })),
    monthShifts.filter((x) => x.s.endsAt < new Date()).map((x) => ({ workerId: id, start: x.s.startsAt, end: x.s.endsAt })),
  );
  const real = days.reduce((s, d) => s + d.real, 0);
  const planned = days.reduce((s, d) => s + d.planned, 0);
  const overtime = days.reduce((s, d) => s + d.overtime, 0);
  const upcoming = data.asg.filter((x) => x.s.startsAt > new Date()).reverse();
  const past = data.asg.filter((x) => x.s.startsAt <= new Date());

  return (
    <>
      <PageHeader icon={HardHat} title={w.name} back={{ href: "/app/personal", label: "Personal" }}>
        {!w.active && <StatusPill>Inactivo</StatusPill>}
        <TrainingPill expires={w.trainingExpiresAt} />
      </PageHeader>
      <PersonalTabs />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <WorkerDot color={w.color} name={w.name} />
                <div>
                  <CardTitle>{w.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{WORKER_TYPE_LABELS[w.type] ?? w.type}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Correo:</span> {w.email ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Teléfono:</span> {w.phone ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Domicilio:</span> {w.address ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Límite semanal:</span> {w.weeklyHoursLimit} h
              </p>
              {showCost && (
                <p>
                  <span className="text-muted-foreground">Coste:</span> {formatEUR(Number(w.costPerHour))}/h
                </p>
              )}
              <div className="pt-1">
                <SkillChips skills={w.skills} max={10} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Horas este mes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Previstas", planned],
                ["Reales", real],
                ["Extra", overtime],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border p-3">
                  <p className="tabular text-xl font-semibold">{(v as number).toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{l}</p>
                </div>
              ))}
              <p className="col-span-3 text-left text-xs text-muted-foreground">
                {data.entries.length} fichajes · {days.reduce((s, d) => s + d.diets, 0)} dietas
              </p>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <AbsencesCard workerId={w.id} canEdit={canEdit} items={data.unav.map((u) => ({ id: u.id, kind: u.kind, startsAt: u.startsAt.toISOString(), endsAt: u.endsAt.toISOString(), note: u.note }))} />
            {canEdit && <LinkUserCard workerId={w.id} userId={w.userId} members={data.members} />}
          </div>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Próximos turnos</h2>
          {upcoming.length === 0 ? (
            <EmptyState icon={HardHat} title="Sin turnos próximos" description="Asígnale turnos desde el tablero." />
          ) : (
            <ShiftTable rows={upcoming} />
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Historial (60 días)</h2>
          {past.length === 0 ? <p className="text-sm text-muted-foreground">Sin turnos recientes.</p> : <ShiftTable rows={past} />}
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Fichajes del mes</h2>
          {data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin fichajes este mes.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Día</TH>
                  <TH>Entrada</TH>
                  <TH>Salida</TH>
                  <TH className="text-right">Pausa</TH>
                  <TH className="text-right">Horas</TH>
                  <TH>Origen</TH>
                </TR>
              </THead>
              <TBody>
                {data.entries.map((e) => (
                  <TR key={e.id}>
                    <TD>{formatDate(e.clockIn, { weekday: "short", day: "numeric", month: "short" })}</TD>
                    <TD className="tabular">{formatTime(e.clockIn)}</TD>
                    <TD className="tabular">{e.clockOut ? formatTime(e.clockOut) : <StatusPill tone="warning">Abierto</StatusPill>}</TD>
                    <TD className="tabular text-right">{e.breakMinutes} min</TD>
                    <TD className="tabular text-right">{workedHours(e).toFixed(2)}</TD>
                    <TD className="text-xs text-muted-foreground">{e.editReason ? `Corregido: ${e.editReason}` : e.source}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>
      </PageBody>
    </>
  );
}

function ShiftTable({ rows }: { rows: { a: { status: string }; s: { id: string; title: string; phaseKind: string; startsAt: Date; endsAt: Date }; project: string | null }[] }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Inicio</TH>
          <TH>Fase</TH>
          <TH>Turno</TH>
          <TH className="text-right">Horas</TH>
          <TH>Estado</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map(({ a, s, project }) => (
          <TR key={s.id}>
            <TD className="tabular whitespace-nowrap">{formatDateTime(s.startsAt)}</TD>
            <TD>{PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind}</TD>
            <TD>
              {s.title}
              {project && <span className="block text-xs text-muted-foreground">{project}</span>}
            </TD>
            <TD className="tabular text-right">{((s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000).toFixed(1)}</TD>
            <TD>
              <StatusPill tone={ASSIGNMENT_TONE[a.status] ?? "neutral"}>{ASSIGNMENT_LABEL[a.status] ?? a.status}</StatusPill>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
void lt;
