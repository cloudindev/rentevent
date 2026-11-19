import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, House, Receipt, Tent, Users } from "lucide-react";
import { addDays, dayKey, parseDayKey, PHASE_LABELS, zonedTime, type PhaseKind } from "@rentevent/core";
import { and, asc, assignments, count, eq, gte, inArray, invoices, lt, lte, orders, projectPhases, projects, quotes, shifts, sql, tenantSettings, items } from "@rentevent/db";
import { checkOrderAvailability } from "@rentevent/db/services";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ORDER_STATUS } from "@/components/app/order-status";
import { can } from "@/lib/permissions";
import { formatDate, formatEUR, formatTime } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { weeklyOccupancy } from "@/server/occupancy";

export const metadata = { title: "Inicio" };

function heat(pct: number) {
  if (pct >= 100) return "bg-danger text-white dark:text-black";
  if (pct >= 85) return "bg-danger-bg text-danger";
  if (pct >= 60) return "bg-warning-bg text-warning";
  if (pct > 0) return "bg-success-bg text-success";
  return "bg-subtle text-muted-foreground";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ denegado?: string }> }) {
  const sp = await searchParams;
  const d = await tenantDb(async (tx, ctx) => {
    const today = dayKey(Date.now());
    const [y, m, dd] = parseDayKey(today);
    const t0 = new Date(zonedTime(y, m, dd));
    const [y2, m2, d2] = parseDayKey(addDays(today, 2));
    const t2 = new Date(zonedTime(y2, m2, d2));
    const in30 = new Date(t0.getTime() + 30 * 86_400_000);
    const in14 = new Date(t0.getTime() + 14 * 86_400_000);
    const monthStart = `${today.slice(0, 7)}-01`;

    const [settings] = await tx.select().from(tenantSettings);
    const phases = await tx
      .select({ id: projectPhases.id, kind: projectPhases.kind, s: projectPhases.startsAt, e: projectPhases.endsAt, pid: projects.id, name: projects.name, status: projects.status, address: projects.locationAddress })
      .from(projectPhases)
      .innerJoin(projects, eq(projects.id, projectPhases.projectId))
      .where(and(lt(projectPhases.startsAt, t2), gte(projectPhases.endsAt, t0), inArray(projectPhases.kind, ["carga", "montaje", "desmontaje", "retorno"]), inArray(projects.status, ["confirmado", "en_curso", "opcion"])))
      .orderBy(asc(projectPhases.startsAt));

    const upcoming = await tx.select().from(orders).where(and(inArray(orders.status, ["confirmado", "opcion", "en_curso"]), lt(orders.periodStart, in30), gte(orders.periodEnd, t0))).orderBy(asc(orders.periodStart));
    const conflicts: { id: string; number: string; title: string; status: string; missing: number; start: Date }[] = [];
    for (const o of upcoming.slice(0, 40)) {
      const checks = await checkOrderAvailability(tx, o.id);
      const missing = checks.reduce((s, c) => s + c.shortage, 0);
      if (missing > 0) conflicts.push({ id: o.id, number: o.number, title: o.title, status: o.status, missing, start: o.periodStart });
    }

    const sh = await tx.select({ id: shifts.id, title: shifts.title, s: shifts.startsAt, need: shifts.requiredPeople, have: sql<number>`(select count(*)::int from ${assignments} a where a.shift_id = ${shifts.id})` }).from(shifts).where(and(gte(shifts.startsAt, t0), lt(shifts.startsAt, in14))).orderBy(asc(shifts.startsAt));
    const understaffed = sh.filter((s) => Number(s.have) < s.need);

    const pending = await tx.select().from(orders).where(inArray(orders.status, ["consulta", "opcion", "borrador"])).orderBy(asc(orders.periodStart)).limit(8);
    const expiring = pending.filter((o) => o.status === "opcion" && o.optionExpiresAt && o.optionExpiresAt.getTime() < Date.now() + 3 * 86_400_000);
    const sentQuotes = await tx.select({ c: count() }).from(quotes).where(eq(quotes.status, "enviado"));

    const [billing] = await tx.select({ total: sql<number>`coalesce(sum(${invoices.subtotal}),0)::float`, n: count() }).from(invoices).where(and(gte(invoices.issueDate, monthStart), lte(invoices.issueDate, today), inArray(invoices.status, ["emitida", "cobrada", "vencida"])));
    const [overdue] = await tx.select({ total: sql<number>`coalesce(sum(${invoices.total} - ${invoices.paid}),0)::float` }).from(invoices).where(eq(invoices.status, "vencida"));

    const trusses = await tx.select({ id: items.id, sku: items.sku, total: items.stockTotal, repair: items.stockRepair }).from(items).where(and(eq(items.role, "cercha"), eq(items.active, true))).orderBy(asc(items.sku));
    const occ = await weeklyOccupancy(tx, trusses.map((t) => t.id), new Map(trusses.map((t) => [t.id, { total: Number(t.total), repair: Number(t.repair) }])), 8);

    return { ctx, settings, phases, conflicts, understaffed, pending, expiring, sentQuotes: sentQuotes[0]?.c ?? 0, billing, overdue, trusses, occ };
  });
  const { ctx } = d;
  const hello = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const todayKey = dayKey(Date.now());
  const kpis = [
    { label: "Montajes y desmontajes (48 h)", value: d.phases.filter((p) => p.kind === "montaje" || p.kind === "desmontaje").length, icon: CalendarClock, href: "/app/agenda?vista=semana", tone: "neutral" as const },
    { label: "Conflictos de material (30 d)", value: d.conflicts.length, icon: AlertTriangle, href: "#conflictos", tone: d.conflicts.length ? ("danger" as const) : ("success" as const) },
    { label: "Turnos sin cubrir (14 d)", value: d.understaffed.length, icon: Users, href: "/app/personal/tablero", tone: d.understaffed.length ? ("warning" as const) : ("success" as const) },
    { label: "Facturado este mes", value: can(ctx.role, "finanzas") ? formatEUR(Number(d.billing?.total ?? 0)) : "—", icon: Receipt, href: "/app/finanzas", tone: "neutral" as const },
  ];
  return (
    <>
      <PageHeader icon={House} title="Inicio" subtitle={hello} />
      <PageBody>
        {sp.denegado && <p className="rounded-lg bg-warning-bg px-4 py-2 text-sm text-warning">No tienes permiso para abrir esa sección.</p>}
        {d.settings && !d.settings.onboardingDone && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm dark:border-brand-900 dark:bg-brand-950">
            <span className="flex-1">Termina de configurar tu empresa: datos fiscales, familias de carpa, inventario y equipo.</span>
            <Button asChild size="sm"><Link href="/app/onboarding">Continuar <ArrowRight /></Link></Button>
          </div>
        )}
        <h2 className="text-xl font-semibold">Hola, {ctx.user.name.split(" ")[0]}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="group rounded-xl border bg-card p-4 transition-colors hover:bg-subtle">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">{k.label}</p>
                <k.icon className="size-4 text-muted-foreground" strokeWidth={1.6} />
              </div>
              <p className={`tabular mt-2 text-2xl font-semibold ${k.tone === "danger" ? "text-danger" : k.tone === "warning" ? "text-warning" : ""}`}>{k.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHeader><CardTitle>Hoy y mañana en obra</CardTitle><Link href="/app/agenda?vista=dia" className="text-sm text-link hover:underline">Agenda</Link></CardHeader>
              <CardContent>
                {d.phases.length === 0 ? <p className="text-sm text-muted-foreground">Ningún montaje, desmontaje ni carga previstos.</p> : (
                  <ul className="divide-y text-sm">
                    {d.phases.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 py-2.5">
                        <span className="w-24 shrink-0 text-muted-foreground">{dayKey(p.s.getTime()) === todayKey ? "Hoy" : "Mañana"} {formatTime(p.s)}</span>
                        <StatusPill tone={p.kind === "montaje" ? "brand" : p.kind === "desmontaje" ? "warning" : "neutral"}>{PHASE_LABELS[p.kind as PhaseKind]}</StatusPill>
                        <Link href={`/app/proyectos/${p.pid}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.name}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card id="conflictos">
              <CardHeader><CardTitle>Conflictos de material</CardTitle></CardHeader>
              <CardContent>
                {d.conflicts.length === 0 ? <p className="text-sm text-success">Todos los pedidos confirmados y en opción de los próximos 30 días tienen material.</p> : (
                  <ul className="divide-y text-sm">
                    {d.conflicts.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                        <Link href={`/app/pedidos/${c.id}`} className="min-w-0 truncate hover:underline"><span className="text-muted-foreground">{c.number}</span> · {c.title} <span className="text-muted-foreground">· {formatDate(c.start, { day: "numeric", month: "short" })}</span></Link>
                        <StatusPill tone="danger">Faltan {c.missing}</StatusPill>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ocupación de cerchas · 8 semanas</CardTitle><Link href="/app/carpas/ocupacion" className="text-sm text-link hover:underline">Detalle</Link></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr>
                      <th />
                      {d.occ.weeks.map((w) => <th key={w.week} className="px-0.5 pb-1 text-center font-normal text-muted-foreground">{formatDate(w.start, { day: "numeric", month: "short" })}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {d.trusses.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap pr-2 font-medium">{t.sku}</td>
                        {d.occ.byItem.get(t.id)!.map((c) => <td key={c.week} className="p-0.5"><div className={`tabular flex h-7 items-center justify-center rounded ${heat(c.pct)}`} title={`Libres ${c.available}`}>{c.pct ? `${c.pct}%` : "·"}</div></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          <aside className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Pedidos pendientes</CardTitle><Link href="/app/pedidos" className="text-sm text-link hover:underline">Todos</Link></CardHeader>
              <CardContent>
                {d.expiring.length > 0 && <p className="mb-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">{d.expiring.length} opción(es) caducan en menos de 3 días.</p>}
                <p className="mb-2 text-xs text-muted-foreground">{d.sentQuotes} presupuestos enviados sin respuesta</p>
                <ul className="divide-y text-sm">
                  {d.pending.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/app/pedidos/${o.id}`} className="min-w-0 truncate hover:underline">{o.title}</Link>
                      <StatusPill tone={ORDER_STATUS[o.status]?.tone ?? "neutral"}>{ORDER_STATUS[o.status]?.label}</StatusPill>
                    </li>
                  ))}
                  {d.pending.length === 0 && <li className="py-2 text-muted-foreground">Nada pendiente.</li>}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Personal sin cubrir</CardTitle><Link href="/app/personal/tablero" className="text-sm text-link hover:underline">Tablero</Link></CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {d.understaffed.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0 truncate">{s.title}</span>
                      <span className="shrink-0 text-xs text-warning">{Number(s.have)}/{s.need} · {formatDate(s.s, { day: "numeric", month: "short" })}</span>
                    </li>
                  ))}
                  {d.understaffed.length === 0 && <li className="py-2 text-success">Todos los turnos de las próximas 2 semanas están cubiertos.</li>}
                </ul>
              </CardContent>
            </Card>
            {can(ctx.role, "finanzas") && (
              <Card>
                <CardHeader><CardTitle>Finanzas</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Facturado este mes ({d.billing?.n ?? 0})</span><span className="tabular">{formatEUR(Number(d.billing?.total ?? 0))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Vencido sin cobrar</span><span className={`tabular ${Number(d.overdue?.total ?? 0) > 0 ? "text-danger" : ""}`}>{formatEUR(Number(d.overdue?.total ?? 0))}</span></div>
                </CardContent>
              </Card>
            )}
            <Link href="/app/carpas/ocupacion" className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm hover:bg-subtle"><Tent className="size-4" /> ¿Qué carpa puedo montar en unas fechas?</Link>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
