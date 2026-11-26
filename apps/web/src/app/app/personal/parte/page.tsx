import { ClipboardList } from "lucide-react";
import { and, asc, assignments, eq, gt, inArray, jobReports, lt, projects, shifts, tenantSettings, timeEntries, vehicles, workers } from "@rentevent/db";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PersonalTabs } from "@/components/crew/personal-tabs";
import { EmptyState } from "@/components/ui/empty";
import { formatDate, formatTime } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { madridMidnight, shiftKey } from "@/server/crew/board";
import { madridDay, mergeShiftReports } from "@/server/crew/hours";
import { DatePicker, PrintButton } from "./client";

export const metadata = { title: "Parte de trabajo" };

export default async function PartePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : madridDay(new Date());
  const from = new Date(madridMidnight(day));
  const to = new Date(madridMidnight(shiftKey(day, 1)));
  const data = await tenantDb(async (tx) => {
    const sh = await tx
      .select({ s: shifts, project: projects.name, vehicle: vehicles.name, plate: vehicles.plate })
      .from(shifts)
      .leftJoin(projects, eq(projects.id, shifts.projectId))
      .leftJoin(vehicles, eq(vehicles.id, shifts.vehicleId))
      .where(and(lt(shifts.startsAt, to), gt(shifts.endsAt, from)))
      .orderBy(asc(shifts.startsAt));
    const ids = sh.map((x) => x.s.id);
    const [asg, entries, reports, settings] = await Promise.all([
      ids.length ? tx.select({ a: assignments, name: workers.name }).from(assignments).innerJoin(workers, eq(workers.id, assignments.workerId)).where(inArray(assignments.shiftId, ids)) : [],
      ids.length ? tx.select().from(timeEntries).where(inArray(timeEntries.shiftId, ids)) : [],
      ids.length ? tx.select({ r: jobReports, workerName: workers.name }).from(jobReports).leftJoin(workers, eq(workers.id, jobReports.workerId)).where(inArray(jobReports.shiftId, ids)) : [],
      tx.select().from(tenantSettings),
    ]);
    return { sh, asg, entries, reports, company: settings[0]?.legalName ?? "" };
  });
  return (
    <>
      <style>{`@media print { aside, .md\\:hidden { display: none !important; } body, main, #contenido { overflow: visible !important; height: auto !important; } .bg-canvas { background: #fff !important; padding: 0 !important; } .md\\:h-\\[calc\\(100dvh-16px\\)\\], .h-dvh { height: auto !important; overflow: visible !important; border: 0 !important; } @page { size: A4; margin: 12mm; } }`}</style>
      <div className="print:hidden">
        <PageHeader icon={ClipboardList} title="Personal" subtitle="Parte de trabajo">
          <DatePicker value={day} />
          <PrintButton />
        </PageHeader>
        <PersonalTabs />
      </div>
      <PageBody className="print:max-w-none print:p-0">
        <div className="hidden print:block">
          <p className="text-xs text-muted-foreground">{data.company}</p>
          <h1 className="text-xl font-semibold">Parte de trabajo · {formatDate(from, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
        </div>
        {data.sh.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No hay turnos este día" description="Elige otra fecha para imprimir el parte por cuadrilla." />
        ) : (
          data.sh.map(({ s, project, vehicle, plate }) => {
            const crew = data.asg.filter((x) => x.a.shiftId === s.id && x.a.status !== "rechazado");
            // each worker files their own report: show them merged, one parte per shift
            const report = mergeShiftReports(
              data.reports.filter((x) => x.r.shiftId === s.id).map(({ r, workerName }) => ({ ...r, workerName: workerName ?? "Trabajador", checklist: (r.checklist as { label: string; done: boolean }[]) ?? [] })),
              s.checklist as string[],
            );
            const checklist = report.checklist;
            return (
              <article key={s.id} className="break-inside-avoid rounded-xl border p-5 print:rounded-none print:border-black/40">
                <header className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
                  <div>
                    <h2 className="text-base font-semibold">{PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind} · {project ?? s.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(s.startsAt)}–{formatTime(s.endsAt)} · {s.address ?? "Sin dirección"} {vehicle && `· ${vehicle} ${plate ?? ""}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{crew.length}/{s.requiredPeople} personas</span>
                </header>
                <div className="grid gap-5 pt-3 md:grid-cols-2 print:grid-cols-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-1 font-normal">Trabajador</th>
                        <th className="py-1 font-normal">Entrada</th>
                        <th className="py-1 font-normal">Salida</th>
                        <th className="py-1 font-normal">Firma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crew.map(({ a, name }) => {
                        const e = data.entries.find((x) => x.workerId === a.workerId && x.shiftId === s.id);
                        return (
                          <tr key={a.workerId} className="border-t">
                            <td className="py-2">{name}</td>
                            <td className="tabular">{e ? formatTime(e.clockIn) : "____"}</td>
                            <td className="tabular">{e?.clockOut ? formatTime(e.clockOut) : "____"}</td>
                            <td className="w-28 border-b border-dashed" />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">Lista de comprobación</p>
                    {checklist.map((c) => (
                      <p key={c.label} className="flex items-center gap-2">
                        <span className="inline-block size-3.5 rounded-sm border border-current text-center text-[10px] leading-3">{c.done ? "✓" : ""}</span> {c.label}
                      </p>
                    ))}
                    {report.incidents.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground">Incidencias:</p>
                        {report.incidents.map((i) => (
                          <p key={i.workerName + i.text} className="whitespace-pre-wrap">{report.incidents.length > 1 || crew.length > 1 ? <span className="font-medium">{i.workerName}: </span> : null}{i.text}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <footer className="mt-4 grid grid-cols-2 gap-6 pt-2 text-xs text-muted-foreground">
                  <div>
                    Jefe de equipo
                    <div className="mt-8 border-b border-dashed" />
                  </div>
                  <div>
                    Cliente {report.clientName ? `(${report.clientName})` : ""}
                    {report.clientSignature ? <img src={report.clientSignature} alt="Firma del cliente" className="mt-1 h-12" /> : <div className="mt-8 border-b border-dashed" />}
                  </div>
                </footer>
              </article>
            );
          })
        )}
      </PageBody>
    </>
  );
}
