import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import { and, asc, assignments, auditLog, contacts, desc, eq, files, inArray, invoices, notes, or, orderLines, orders, projectPhases, projects, purchases, quotes, shifts, subrentals, tasks, timeEntries, vehicles, venues, workers } from "@rentevent/db";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { AuditTrail } from "@/components/app/audit-trail";
import { NotesPanel } from "@/components/app/notes-panel";
import { ORDER_STATUS } from "@/components/app/order-status";
import { DateChip, PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, canCollaborate, canSeeField } from "@/lib/permissions";
import { formatDateTime, formatEUR, formatRange, formatDate } from "@/lib/utils";
import { fileUrl } from "@/lib/adapters/storage";
import { tenantDb } from "@/server/context";
import { PhaseTimeline } from "./phase-timeline";
import { ProjectActions, TasksPanel, FilesPanel, GenerateShiftsButton } from "./panels";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await tenantDb(async (tx, ctx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, id));
    if (!p) return null;
    const [client] = p.clientId ? await tx.select().from(contacts).where(eq(contacts.id, p.clientId)) : [undefined];
    const [venue] = p.venueId ? await tx.select().from(venues).where(eq(venues.id, p.venueId)) : [undefined];
    const phases = await tx.select().from(projectPhases).where(eq(projectPhases.projectId, id)).orderBy(asc(projectPhases.startsAt));
    const os = await tx.select().from(orders).where(eq(orders.projectId, id)).orderBy(asc(orders.number));
    const orderIds = os.map((o) => o.id);
    const qs = orderIds.length ? await tx.select().from(quotes).where(inArray(quotes.orderId, orderIds)).orderBy(desc(quotes.version)) : [];
    const sh = await tx.select().from(shifts).where(eq(shifts.projectId, id)).orderBy(asc(shifts.startsAt));
    const asg = sh.length ? await tx.select({ shiftId: assignments.shiftId, workerId: assignments.workerId, status: assignments.status, name: workers.name, cost: workers.costPerHour }).from(assignments).innerJoin(workers, eq(workers.id, assignments.workerId)).where(inArray(assignments.shiftId, sh.map((s) => s.id))) : [];
    const vs = await tx.select().from(vehicles);
    const tk = await tx.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(asc(tasks.done), asc(tasks.dueAt));
    const fl = await tx.select().from(files).where(and(eq(files.entity, "project"), eq(files.entityId, id))).orderBy(desc(files.createdAt));
    const nt = await tx.select().from(notes).where(and(eq(notes.entity, "project"), eq(notes.entityId, id))).orderBy(desc(notes.createdAt));
    const au = await tx.select().from(auditLog).where(or(and(eq(auditLog.entity, "project"), eq(auditLog.entityId, id)), orderIds.length ? and(eq(auditLog.entity, "order"), inArray(auditLog.entityId, orderIds)) : undefined)).orderBy(desc(auditLog.createdAt)).limit(30);
    // profitability
    const lines = orderIds.length ? await tx.select().from(orderLines).where(inArray(orderLines.orderId, orderIds)) : [];
    const subs = await tx.select().from(subrentals).where(eq(subrentals.projectId, id));
    const purch = await tx.select().from(purchases).where(eq(purchases.projectId, id));
    const te = sh.length ? await tx.select({ shiftId: timeEntries.shiftId, workerId: timeEntries.workerId, clockIn: timeEntries.clockIn, clockOut: timeEntries.clockOut, breakMinutes: timeEntries.breakMinutes }).from(timeEntries).where(inArray(timeEntries.shiftId, sh.map((s) => s.id))) : [];
    const inv = await tx.select().from(invoices).where(eq(invoices.projectId, id));
    const canEdit = can(ctx.role, "comercial");
    const clientOpts = canEdit ? await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).where(and(eq(contacts.kind, "cliente"), p.clientId ? or(eq(contacts.archived, false), eq(contacts.id, p.clientId)) : eq(contacts.archived, false))).orderBy(asc(contacts.name)) : [];
    const venueOpts = canEdit ? await tx.select({ id: venues.id, name: venues.name }).from(venues).orderBy(asc(venues.name)) : [];
    return { p, client, venue, phases, os, qs, sh, asg, vs, tk, fl, nt, au, lines, subs, purch, te, inv, clientOpts, venueOpts, ctx };
  });
  if (!d) notFound();
  const { p, ctx } = d;
  const showMargin = canSeeField(ctx.role, "margen", ctx.fieldPermissions);
  const latestQuote = (orderId: string) => d.qs.find((q) => q.orderId === orderId);
  const activeOrders = d.os.filter((o) => o.status !== "cancelado");
  // taxable base frozen in the quote (handles mixed VAT rates); very old quotes without it fall back to 21 %
  const quoteBase = (q: (typeof d.qs)[number] | undefined) => {
    if (!q) return 0;
    const t = (q.snapshot as { totals?: { taxable?: unknown } } | null)?.totals?.taxable;
    return typeof t === "number" ? t : Number(q.total) / 1.21;
  };
  const revenueQuoted = activeOrders.reduce((s, o) => s + quoteBase(latestQuote(o.id)), 0);
  const invoiced = d.inv.filter((i) => i.status !== "borrador" && i.status !== "anulada").reduce((s, i) => s + Number(i.subtotal), 0);
  const revenue = Math.max(invoiced, revenueQuoted);
  const linesCost = d.lines.filter((l) => activeOrders.some((o) => o.id === l.orderId)).reduce((s, l) => s + Number(l.unitCost) * Number(l.quantity), 0);
  const subsCost = d.subs.filter((x) => x.status !== "cancelado").reduce((s, x) => s + Number(x.cost), 0);
  const purchCost = d.purch.filter((x) => !x.subrentalId).reduce((s, x) => s + Number(x.base), 0);
  const workerCost = new Map(d.asg.map((a) => [a.workerId, Number(a.cost)]));
  const crewReal = d.te.reduce((s, t) => s + (t.clockOut ? ((t.clockOut.getTime() - t.clockIn.getTime()) / 3_600_000 - t.breakMinutes / 60) * (workerCost.get(t.workerId) ?? 18) : 0), 0);
  const crewPlanned = d.sh.reduce((s, x) => s + d.asg.filter((a) => a.shiftId === x.id).reduce((a, w) => a + ((x.endsAt.getTime() - x.startsAt.getTime()) / 3_600_000) * Number(w.cost), 0), 0);
  const crewCost = crewReal > 0 ? crewReal : crewPlanned;
  const cost = linesCost + subsCost + purchCost + crewCost;
  const margin = revenue - cost;
  const st = ORDER_STATUS[p.status] ?? ORDER_STATUS.consulta!;
  return (
    <>
      <PageHeader icon={Briefcase} title={`${p.number} · ${p.name}`} back={{ href: "/app/proyectos", label: "Proyectos" }}>
        <DateChip>{formatRange(p.startsAt, p.endsAt)}</DateChip>
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        {can(ctx.role, "comercial") && <ProjectActions project={{ id: p.id, name: p.name, startsAt: p.startsAt?.toISOString() ?? null, clientId: p.clientId, venueId: p.venueId, description: p.description, color: p.color, orders: d.os.length }} clients={d.clientOpts} venues={d.venueOpts} />}
      </PageHeader>
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="p-4"><p className="text-xs text-muted-foreground">Cliente</p><p className="mt-1 font-medium">{d.client ? <Link className="hover:underline" href={`/app/contactos/${d.client.id}`}>{d.client.name}</Link> : "—"}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Lugar</p><p className="mt-1 font-medium">{d.venue?.name ?? p.locationAddress ?? "—"}</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Pedidos</p><p className="mt-1 font-medium">{activeOrders.length} activos · {formatEUR(revenueQuoted)} sin IVA</p></Card>
          <Card className="p-4"><p className="text-xs text-muted-foreground">Personal</p><p className="mt-1 font-medium">{d.sh.length} turnos · {new Set(d.asg.map((a) => a.workerId)).size} personas</p></Card>
        </div>
        {p.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.description}</p>}
        <Card>
          <CardHeader><CardTitle>Cronograma</CardTitle></CardHeader>
          <CardContent>
            <PhaseTimeline phases={d.phases.map((x) => ({ id: x.id, kind: x.kind as PhaseKind, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt.toISOString(), notes: x.notes }))} canEdit={can(ctx.role, "comercial")} />
          </CardContent>
        </Card>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos</CardTitle>
                {can(ctx.role, "comercial") && <Button asChild size="sm" variant="outline"><Link href={`/app/pedidos/nuevo?proyecto=${p.id}`}><Plus /> Pedido</Link></Button>}
              </CardHeader>
              <CardContent>
                {d.os.length === 0 ? <p className="text-sm text-muted-foreground">Sin pedidos.</p> : (
                  <ul className="divide-y text-sm">
                    {d.os.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                        <Link className="min-w-0 truncate hover:underline" href={`/app/pedidos/${o.id}`}><span className="text-muted-foreground">{o.number}</span> · {o.title}</Link>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="tabular hidden sm:inline" title="Último presupuesto, sin IVA">{latestQuote(o.id) ? formatEUR(quoteBase(latestQuote(o.id))) : "—"}</span>
                          <StatusPill tone={ORDER_STATUS[o.status]?.tone ?? "neutral"}>{ORDER_STATUS[o.status]?.label}</StatusPill>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Personal y transporte</CardTitle>
                {can(ctx.role, "personal") && <GenerateShiftsButton projectId={p.id} />}
              </CardHeader>
              <CardContent>
                {d.sh.length === 0 ? <p className="text-sm text-muted-foreground">Sin turnos. Genera los turnos desde las fases y el despiece.</p> : (
                  <ul className="divide-y text-sm">
                    {d.sh.map((s) => {
                      const team = d.asg.filter((a) => a.shiftId === s.id);
                      const v = d.vs.find((x) => x.id === s.vehicleId);
                      return (
                        <li key={s.id} className="py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind} · {formatDateTime(s.startsAt)}</span>
                            <StatusPill tone={team.length >= s.requiredPeople ? "success" : "warning"}>{team.length}/{s.requiredPeople} personas</StatusPill>
                          </div>
                          <p className="text-xs text-muted-foreground">{team.map((t) => t.name).join(", ") || "Sin asignar"}{v ? ` · ${v.name}` : ""}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link href="/app/personal/tablero" className="mt-3 inline-block text-sm text-link hover:underline">Abrir tablero de planificación</Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Archivos</CardTitle></CardHeader>
              <CardContent><FilesPanel projectId={p.id} files={d.fl.map((f) => ({ id: f.id, name: f.name, size: f.size, url: fileUrl(f.key), createdAt: formatDate(f.createdAt) }))} canEdit={can(ctx.role, "comercial")} /></CardContent>
            </Card>
          </div>
          <aside className="space-y-5">
            {showMargin && (
              <Card>
                <CardHeader><CardTitle>Rentabilidad</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{invoiced >= revenueQuoted && invoiced > 0 ? "Facturado" : "Presupuestado"} (sin IVA)</span><span className="tabular">{formatEUR(revenue)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Personal {crewReal > 0 ? "(fichado)" : "(previsto)"}</span><span className="tabular">− {formatEUR(crewCost)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Transporte y costes de línea</span><span className="tabular">− {formatEUR(linesCost)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Subalquileres</span><span className="tabular">− {formatEUR(subsCost)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Compras imputadas</span><span className="tabular">− {formatEUR(purchCost)}</span></div>
                  <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Margen</span><span className={`tabular ${margin < 0 ? "text-danger" : "text-success"}`}>{formatEUR(margin)}{revenue > 0 ? ` · ${Math.round((margin / revenue) * 100)} %` : ""}</span></div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader><CardTitle>Tareas</CardTitle></CardHeader>
              <CardContent><TasksPanel projectId={p.id} canEdit={canCollaborate(ctx.role)} tasks={d.tk.map((t) => ({ id: t.id, title: t.title, done: t.done, dueAt: t.dueAt?.toISOString() ?? null }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
              <CardContent><NotesPanel entity="project" entityId={p.id} path={`/app/proyectos/${p.id}`} notes={d.nt.map((n) => ({ id: n.id, body: n.body, authorName: n.authorName, createdAt: n.createdAt.toISOString() }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Historial de cambios</CardTitle></CardHeader>
              <CardContent><AuditTrail rows={d.au} /></CardContent>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
