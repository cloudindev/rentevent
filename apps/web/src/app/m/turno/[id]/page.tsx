import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { Box, ChevronLeft, MapPin, Navigation, Phone, Truck, Users } from "lucide-react";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { StatusPill } from "@/components/ui/badge";
import { ASSIGNMENT_LABEL, ASSIGNMENT_TONE } from "@/components/crew/bits";
import { ClockForShift, JobReportForm } from "@/components/crew/job-report-form";
import { RespondButtons } from "@/components/crew/respond-buttons";
import { navigationUrl } from "@/lib/adapters/maps";
import { formatDate, formatNumber, formatTime } from "@/lib/utils";
import { mobileContext, myAgenda, shiftDetail } from "@/server/crew/mobile";

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { ctx, worker } = await mobileContext();
  const d = await shiftDetail(ctx.tenantId, worker?.id ?? null, id);
  if (!d || (!d.mine && ctx.role === "montador") || (!d.s.published && ctx.role === "montador")) notFound();
  const { s } = d;
  const lat = s.lat ?? d.venue?.lat ?? null;
  const lng = s.lng ?? d.venue?.lng ?? null;
  const open = worker ? (await myAgenda(ctx.tenantId, worker.id, new Date(0), new Date(0))).open : null;
  const report = d.report;
  const checklistDefault = (s.checklist as string[]).map((label) => ({ label, done: false }));
  const nameOf = new Map(d.items.map((i) => [i.id, i]));
  const bom = new Map<string, number>();
  for (const c of d.configs) for (const l of c.bom as { itemId: string; quantity: number }[]) bom.set(l.itemId, (bom.get(l.itemId) ?? 0) + l.quantity);
  const totals = d.configs.reduce(
    (acc, c) => {
      const t = ((c.metrics ?? {}) as { totals?: { weightKg?: number; volumeM3?: number } }).totals ?? {};
      return { w: acc.w + (t.weightKg ?? 0), v: acc.v + (t.volumeM3 ?? 0) };
    },
    { w: 0, v: 0 },
  );

  return (
    <div className="space-y-5">
      <Link href="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Agenda
      </Link>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <StatusPill tone="brand" dot={false}>
            {PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind}
          </StatusPill>
          {d.mine && <StatusPill tone={ASSIGNMENT_TONE[d.mine.status] ?? "neutral"}>{ASSIGNMENT_LABEL[d.mine.status] ?? d.mine.status}</StatusPill>}
        </div>
        <h1 className="text-xl font-semibold">{d.project?.name ?? s.title}</h1>
        <p className="text-sm capitalize text-muted-foreground">
          {formatDate(s.startsAt, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
        </p>
      </header>

      {d.mine && s.endsAt > new Date() && <RespondButtons shiftId={s.id} status={d.mine.status} />}

      <section className="space-y-3 rounded-xl border bg-background p-4 text-sm">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {d.venue?.name ?? s.address ?? "Sin dirección"}
            {d.venue?.city && <span className="block text-muted-foreground">{d.venue.city}</span>}
          </span>
        </p>
        {lat != null && lng != null && (
          <a href={navigationUrl(lat, lng)} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-ink font-medium text-white dark:bg-white dark:text-ink">
            <Navigation className="size-4" /> Cómo llegar
          </a>
        )}
        {d.venue?.accessNotes && <p className="rounded-lg bg-subtle p-3 text-muted-foreground">{d.venue.accessNotes}</p>}
        {d.venue && !d.venue.anchoringAllowed && <p className="rounded-lg bg-warning-bg p-3 text-warning">No se puede perforar: montaje con pesos.</p>}
        {d.vehicle && (
          <p className="flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" /> {d.vehicle.name} · {d.vehicle.plate}
          </p>
        )}
        {s.notes && <p className="text-muted-foreground">{s.notes}</p>}
      </section>

      {worker && d.mine && <ClockForShift shiftId={s.id} openHere={open?.shiftId === s.id} openElsewhere={Boolean(open && open.shiftId !== s.id)} />}

      {d.configs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Carpas</h2>
          {d.configs.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-background p-3 text-sm">
              <Box className="size-5 text-muted-foreground" />
              <span className="flex-1">{c.label}</span>
              {c.shareToken && (
                <Link href={`/p/carpa/${c.shareToken}`} className="text-link underline">
                  Ver plano y 3D
                </Link>
              )}
            </div>
          ))}
          <details className="rounded-xl border bg-background">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Despiece ({bom.size} artículos · {formatNumber(totals.w)} kg · {formatNumber(totals.v)} m³)
            </summary>
            <ul className="divide-y border-t text-sm">
              {[...bom.entries()].map(([itemId, q]) => (
                <li key={itemId} className="flex items-center justify-between px-4 py-2">
                  <span>
                    {nameOf.get(itemId)?.name ?? "Artículo"}
                    {nameOf.get(itemId)?.location && <span className="block text-xs text-muted-foreground">Ubicación {nameOf.get(itemId)?.location}</span>}
                  </span>
                  <span className="tabular font-medium">
                    {formatNumber(q)} {nameOf.get(itemId)?.unit === "m2" ? "m²" : "ud"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4" /> Cuadrilla
        </h2>
        <ul className="divide-y rounded-xl border bg-background text-sm">
          {d.crew.map((c) => (
            <li key={c.workerId} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1">{c.name}</span>
              {c.phone && (
                <a href={`tel:${c.phone}`} className="rounded-full p-2 text-muted-foreground hover:bg-accent" aria-label={`Llamar a ${c.name}`}>
                  <Phone className="size-4" />
                </a>
              )}
              <StatusPill tone={ASSIGNMENT_TONE[c.status] ?? "neutral"}>{ASSIGNMENT_LABEL[c.status] ?? c.status}</StatusPill>
            </li>
          ))}
        </ul>
      </section>

      {worker && d.mine && (
        <section className="space-y-3 border-t pt-5">
          <h2 className="text-base font-semibold">Parte de trabajo</h2>
          <JobReportForm
            shiftId={s.id}
            fileBase="/api/files"
            initial={{
              clientRef: report?.clientRef ?? `${s.id.slice(0, 8)}-${worker.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`,
              checklist: (report?.checklist as { label: string; done: boolean }[] | undefined)?.length ? (report!.checklist as { label: string; done: boolean }[]) : checklistDefault,
              incidents: report?.incidents ?? "",
              clientName: report?.clientName ?? "",
              signature: report?.clientSignature ?? null,
              photos: (report?.photos as { key: string; stage: "inicio" | "fin" }[] | undefined) ?? [],
              completed: Boolean(report?.completedAt),
            }}
          />
        </section>
      )}
    </div>
  );
}
