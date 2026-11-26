"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Megaphone, Plus, Sparkles, Truck, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  checkAssignment,
  hasBlockingConflict,
  PHASE_LABELS,
  SKILL_LABELS,
  SKILLS,
  type Conflict,
  type ExistingAssignment,
  type PhaseKind,
  type ShiftInfo,
  type Skill,
  type WorkerInfo,
} from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Sheet } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { assignVehicle } from "@/server/actions/transport";
import { assignWorker, deleteShift, publishPlanning, saveShift, suggestForShift, unassignWorker } from "@/server/actions/crew";
import { blockPosition, dayBlockPosition, DAY_WINDOW, shiftKey, stackLanes, type BoardRange } from "@/server/crew/board";
import { madridDay } from "@/server/crew/hours";
import { ASSIGNMENT_LABEL, ASSIGNMENT_TONE, WorkerDot } from "./bits";

export type BoardShift = {
  id: string;
  title: string;
  phaseKind: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  orderNumber: string | null;
  start: number;
  end: number;
  requiredPeople: number;
  requiredSkills: string[];
  vehicleId: string | null;
  vehicleLicence: string | null;
  published: boolean;
  address: string | null;
  notes: string | null;
  location: { lat: number; lng: number } | null;
};
export type BoardData = {
  anchor: string;
  mode: "semana" | "dia";
  view: "trabajador" | "proyecto" | "cuadrilla";
  range: BoardRange;
  canEdit: boolean;
  isAdmin: boolean;
  workers: { id: string; name: string; color: string | null; skills: string[]; trainingExpiresAt: string | null; weeklyHoursLimit: number; type: string }[];
  workerInfos: WorkerInfo[];
  shifts: BoardShift[];
  assignments: { shiftId: string; workerId: string; status: string; overrideReason: string | null }[];
  vehicles: { id: string; name: string; licence: string; maxPayloadKg: number }[];
  projects: { id: string; name: string; color: string | null }[];
};

const PHASE_COLOR: Record<string, string> = {
  carga: "#0891b2",
  transporte: "#7c3aed",
  montaje: "#16a34a",
  desmontaje: "#ea580c",
  retorno: "#4f46e5",
  otro: "#6b6b68",
};

type Pending = { shift: BoardShift; workerId: string; replaceWorkerId: string | null; conflicts: Conflict[] };

export function Board({ data }: { data: BoardData }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [pending, setPending] = useState<Pending | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [newShift, setNewShift] = useState(false);

  const shiftById = useMemo(() => new Map(data.shifts.map((s) => [s.id, s])), [data.shifts]);
  const infoById = useMemo(
    () => new Map<string, ShiftInfo>(data.shifts.map((s) => [s.id, { id: s.id, start: s.start, end: s.end, requiredSkills: s.requiredSkills, vehicleLicence: s.vehicleLicence, location: s.location, label: s.title }])),
    [data.shifts],
  );
  const live = data.assignments.filter((a) => a.status !== "rechazado");
  const existing: ExistingAssignment[] = useMemo(() => live.filter((a) => infoById.has(a.shiftId)).map((a) => ({ workerId: a.workerId, shift: infoById.get(a.shiftId)! })), [live, infoById]);
  const visible = data.shifts.filter((s) => s.end > data.range.start && s.start < data.range.end);
  const crewOf = (shiftId: string) => live.filter((a) => a.shiftId === shiftId);
  const uncovered = visible.filter((s) => crewOf(s.id).length < s.requiredPeople);

  const nav = (patch: Partial<{ fecha: string; modo: string; vista: string }>) => {
    const p = new URLSearchParams({ fecha: data.anchor, modo: data.mode, vista: data.view, ...patch });
    router.push(`/app/personal/tablero?${p.toString()}`);
  };

  function evaluate(shift: BoardShift, workerId: string, replaceWorkerId: string | null): Conflict[] {
    const worker = data.workerInfos.find((w) => w.id === workerId);
    if (!worker) return [];
    const ex = existing.filter((e) => !(e.shift.id === shift.id && e.workerId === replaceWorkerId));
    const crewIds = crewOf(shift.id).map((a) => a.workerId).filter((id) => id !== replaceWorkerId);
    return checkAssignment({ worker, shift: infoById.get(shift.id)!, existing: ex, crewOnShift: data.workerInfos.filter((w) => crewIds.includes(w.id)) });
  }

  function commit(p: Pending, reason?: string) {
    start(async () => {
      const r = await assignWorker({ shiftId: p.shift.id, workerId: p.workerId, replaceWorkerId: p.replaceWorkerId, overrideReason: reason || null });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Asignación guardada");
      setPending(null);
      setOverrideReason("");
      router.refresh();
    });
  }

  function requestAssign(shiftId: string, workerId: string, replaceWorkerId: string | null) {
    if (!data.canEdit) return;
    const shift = shiftById.get(shiftId);
    if (!shift || replaceWorkerId === workerId) return;
    if (crewOf(shiftId).some((a) => a.workerId === workerId)) return void toast.info("Ya está en ese turno");
    const conflicts = evaluate(shift, workerId, replaceWorkerId);
    const p = { shift, workerId, replaceWorkerId, conflicts };
    if (conflicts.length === 0) commit(p);
    else setPending(p);
  }

  const onDrop = (workerId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData("application/json")) as { shiftId: string; fromWorker: string | null };
      requestAssign(payload.shiftId, workerId, payload.fromWorker);
    } catch {
      /* foreign drag */
    }
  };
  const dragProps = (shiftId: string, fromWorker: string | null) =>
    data.canEdit
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            e.dataTransfer.setData("application/json", JSON.stringify({ shiftId, fromWorker }));
            e.dataTransfer.effectAllowed = "move";
          },
        }
      : {};

  const rangeLabel = data.mode === "dia" ? formatDate(data.range.start, { weekday: "long", day: "numeric", month: "long" }) : `${formatDate(data.range.start, { day: "numeric", month: "short" })} – ${formatDate(data.range.end - 1, { day: "numeric", month: "short", year: "numeric" })}`;
  const step = data.mode === "dia" ? 1 : 7;
  const sel = selected ? shiftById.get(selected) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline" aria-label="Anterior" onClick={() => nav({ fecha: shiftKey(data.anchor, -step) })}>
            <ChevronLeft />
          </Button>
          <Button size="sm" variant="outline" onClick={() => nav({ fecha: madridDay(new Date()) })}>
            Hoy
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Siguiente" onClick={() => nav({ fecha: shiftKey(data.anchor, step) })}>
            <ChevronRight />
          </Button>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-medium capitalize">
          <CalendarDays className="size-4 text-muted-foreground" /> {rangeLabel}
        </span>
        <div className="flex-1" />
        <Segmented value={data.mode} onChange={(v) => nav({ modo: v })} options={[["semana", "Semana"], ["dia", "Día"]]} label="Escala" />
        <Segmented value={data.view} onChange={(v) => nav({ vista: v })} options={[["trabajador", "Trabajadores"], ["proyecto", "Proyectos"], ["cuadrilla", "Cuadrillas"]]} label="Vista" />
        {data.canEdit && (
          <>
            <Button size="sm" variant="outline" onClick={() => setNewShift(true)}>
              <Plus /> Turno
            </Button>
            <Button size="sm" onClick={() => setPublishOpen(true)}>
              <Megaphone /> Publicar planning
            </Button>
          </>
        )}
      </div>

      {visible.length === 0 && data.view !== "trabajador" ? (
        <div className="p-6">
          <EmptyState icon={CalendarDays} title="No hay turnos en estas fechas" description="Genera turnos desde un proyecto o crea uno manualmente." />
        </div>
      ) : data.view === "cuadrilla" ? (
        <CrewView data={data} shifts={visible} crewOf={crewOf} onOpen={setSelected} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[960px]">
            <div className="sticky top-0 z-10 flex border-b bg-background">
              <div className="w-56 shrink-0 border-r px-4 py-2 text-xs text-muted-foreground">{data.view === "proyecto" ? "Proyecto" : "Trabajador"}{data.mode === "dia" && <span className="text-[10px]"> (05–23 h)</span>}</div>
              <div className="flex flex-1">
                {data.range.days.map((d) => (
                  <div key={d.key} className="flex-1 border-r px-2 py-2 text-xs capitalize text-muted-foreground last:border-r-0">
                    {data.mode === "dia" ? <HourTicks /> : d.label}
                  </div>
                ))}
              </div>
            </div>

            {data.view === "trabajador" ? (
              <>
                <Row label={<span className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-warning" /> Sin cubrir <span className="text-xs font-normal text-muted-foreground">({uncovered.length})</span></span>} days={data.range.days} className="bg-warning-bg/40">
                  <Blocks
                    items={uncovered.map((s) => ({ ...s, key: s.id }))}
                    range={data.range}
                    render={(s) => (
                      <ShiftBlock s={s} label={`${crewOf(s.id).length}/${s.requiredPeople}`} onClick={() => setSelected(s.id)} drag={dragProps(s.id, null)} uncovered />
                    )}
                  />
                </Row>
                {data.workers.map((w) => {
                  const mine = live.filter((a) => a.workerId === w.id).map((a) => ({ a, s: shiftById.get(a.shiftId)! })).filter((x) => x.s && x.s.end > data.range.start && x.s.start < data.range.end);
                  const absences = data.workerInfos.find((i) => i.id === w.id)?.unavailable ?? [];
                  const hours = mine.reduce((sum, x) => sum + (x.s.end - x.s.start) / 3_600_000, 0);
                  return (
                    <Row
                      key={w.id}
                      label={
                        <Link href={`/app/personal/${w.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                          <WorkerDot color={w.color} name={w.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{w.name}</span>
                            <span className={cn("block text-[11px] text-muted-foreground tabular", hours > w.weeklyHoursLimit && data.mode === "semana" && "text-danger")}>
                              {hours.toFixed(1)} h{data.mode === "semana" ? ` / ${w.weeklyHoursLimit}` : ""}
                            </span>
                          </span>
                        </Link>
                      }
                      days={data.range.days}
                      highlight={dragOver === w.id}
                      dropProps={
                        data.canEdit
                          ? {
                              onDragOver: (e: React.DragEvent) => {
                                e.preventDefault();
                                setDragOver(w.id);
                              },
                              onDragLeave: () => setDragOver((x) => (x === w.id ? null : x)),
                              onDrop: onDrop(w.id),
                            }
                          : {}
                      }
                    >
                      {absences.map((u, i) => {
                        const pos = data.mode === "dia" ? blockPosition(u.start, u.end, data.range, DAY_WINDOW) : dayBlockPosition(u.start, u.end, data.range);
                        return pos ? (
                          <div key={i} className="absolute inset-y-1 rounded-md bg-[repeating-linear-gradient(135deg,var(--muted),var(--muted)_6px,transparent_6px,transparent_12px)] text-[10px] text-muted-foreground" style={{ left: `${pos.left}%`, width: `${pos.width}%` }} title={u.reason}>
                            <span className="px-1.5">{u.reason}</span>
                          </div>
                        ) : null;
                      })}
                      <Blocks items={mine.map((x) => ({ ...x.s, key: x.s.id, status: x.a.status }))} range={data.range} render={(s) => <ShiftBlock s={s} status={s.status} onClick={() => setSelected(s.id)} drag={dragProps(s.id, w.id)} />} />
                    </Row>
                  );
                })}
              </>
            ) : (
              <>
                {data.projects
                  .map((p) => ({ p, list: visible.filter((s) => s.projectId === p.id) }))
                  .concat([{ p: { id: "_", name: "Sin proyecto", color: null }, list: visible.filter((s) => !s.projectId) }])
                  .filter((x) => x.list.length > 0)
                  .map(({ p, list }) => (
                    <Row key={p.id} label={<span className="flex min-w-0 items-center gap-2 text-sm" title={p.name}><span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color ?? "#6b6b68" }} />{p.id === "_" ? <span className="truncate">{p.name}</span> : <Link className="line-clamp-2 hover:underline" href={`/app/proyectos/${p.id}`}>{p.name}</Link>}</span>} days={data.range.days}>
                      <Blocks items={list.map((s) => ({ ...s, key: s.id }))} range={data.range} render={(s) => <ShiftBlock s={s} inProjectRow label={`${crewOf(s.id).length}/${s.requiredPeople}`} onClick={() => setSelected(s.id)} uncovered={crewOf(s.id).length < s.requiredPeople} />} />
                    </Row>
                  ))}
              </>
            )}
          </div>
        </div>
      )}

      {data.canEdit && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground md:px-6">
          {Object.entries(PHASE_COLOR)
            .filter(([k]) => k !== "otro")
            .map(([k, c]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm" style={{ background: c }} /> {PHASE_LABELS[k as PhaseKind]}
              </span>
            ))}
          <span className="hidden lg:inline">·</span>
          <span>Arrastra un turno a la fila de un trabajador para asignarlo, o entre trabajadores para cambiarlo. Antes de guardar se comprueban solapes, habilidades, formación, descanso, horas semanales y conductor.</span>
        </p>
      )}

      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>Revisa la asignación</DialogTitle>
                <DialogDescription>
                  {data.workers.find((w) => w.id === pending.workerId)?.name} → {pending.shift.title} ({formatDate(pending.shift.start, { weekday: "short", day: "numeric" })}, {formatTime(pending.shift.start)}–{formatTime(pending.shift.end)})
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {pending.conflicts.map((c, i) => (
                  <li key={i} className={cn("flex gap-2 rounded-lg px-3 py-2 text-sm", c.severity === "error" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning")}>
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {c.message}
                  </li>
                ))}
              </ul>
              {hasBlockingConflict(pending.conflicts) &&
                (data.isAdmin ? (
                  <Field label="Motivo para forzar la asignación (queda registrado)" htmlFor="ovr">
                    <Textarea id="ovr" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="p. ej. el turno anterior termina antes de lo previsto" />
                  </Field>
                ) : (
                  <p className="text-sm text-muted-foreground">Hay conflictos que bloquean la asignación. Solo un administrador puede forzarla.</p>
                ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPending(null)}>
                  Cancelar
                </Button>
                <Button
                  variant={hasBlockingConflict(pending.conflicts) ? "danger" : "default"}
                  disabled={busy || (hasBlockingConflict(pending.conflicts) && (!data.isAdmin || overrideReason.trim().length < 3))}
                  onClick={() => commit(pending, hasBlockingConflict(pending.conflicts) ? overrideReason : undefined)}
                >
                  {hasBlockingConflict(pending.conflicts) ? "Forzar asignación" : "Asignar igualmente"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {sel && <ShiftSheet key={sel.id} shift={sel} data={data} crew={crewOf(sel.id)} onClose={() => setSelected(null)} onAssign={(w) => requestAssign(sel.id, w, null)} />}
      {publishOpen && <PublishDialog range={data.range} onClose={() => setPublishOpen(false)} count={visible.length} unpublished={visible.filter((s) => !s.published).length} />}
      {newShift && <NewShiftDialog data={data} onClose={() => setNewShift(false)} />}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border p-0.5">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("rounded-md px-2.5 py-1 text-[13px] text-muted-foreground", value === v && "bg-accent font-medium text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function HourTicks() {
  return (
    <div className="flex">
      {[5, 8, 11, 14, 17, 20].map((h) => (
        <span key={h} className="flex-1 tabular">
          {String(h).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );
}

function Row({ label, days, children, className, highlight, dropProps }: { label: React.ReactNode; days: BoardRange["days"]; children: React.ReactNode; className?: string; highlight?: boolean; dropProps?: Record<string, unknown> }) {
  return (
    <div className={cn("flex border-b", className)}>
      <div className="flex w-56 shrink-0 items-center border-r px-4 py-1.5">{label}</div>
      <div className={cn("relative min-h-12 flex-1 transition-colors", highlight && "bg-brand-50 dark:bg-brand-950")} {...dropProps}>
        <div className="pointer-events-none absolute inset-0 flex">
          {days.map((d) => (
            <div key={d.key} className="flex-1 border-r last:border-r-0" />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

const BLOCK_H = 40;
const BLOCK_GAP = 4;

function Blocks<T extends { start: number; end: number; key: string }>({ items, range, render }: { items: T[]; range: BoardRange; render: (s: T) => React.ReactNode }) {
  const week = range.days.length > 1;
  // week: each shift fills its day column(s), stacked by day; day: exact hours
  const placed = items
    .map((s) => {
      if (week) {
        const pos = dayBlockPosition(s.start, s.end, range);
        return pos && { s, pos, start: pos.from, end: pos.to, sortKey: s.start };
      }
      const pos = blockPosition(s.start, s.end, range, DAY_WINDOW);
      return pos && { s, pos, start: s.start, end: s.end, sortKey: s.start };
    })
    .filter((x) => x !== null)
    .sort((a, b) => a.start - b.start || a.sortKey - b.sortKey);
  const stacked = stackLanes(placed);
  const lanes = Math.max(1, ...stacked.map((x) => x.lane + 1));
  return (
    <div className="relative" style={{ height: lanes * (BLOCK_H + BLOCK_GAP) + 8 }}>
      {stacked.map(({ s, pos, lane }) => (
        <div key={s.key} className={cn("absolute", week ? "px-1.5" : "px-0.5")} style={{ left: `${pos.left}%`, width: `${pos.width}%`, top: 6 + lane * (BLOCK_H + BLOCK_GAP), height: BLOCK_H }}>
          {render(s)}
        </div>
      ))}
    </div>
  );
}

function ShiftBlock({ s, label, status, onClick, drag, uncovered, inProjectRow }: { s: BoardShift; label?: string; status?: string; onClick: () => void; drag?: Record<string, unknown>; uncovered?: boolean; inProjectRow?: boolean }) {
  const color = PHASE_COLOR[s.phaseKind] ?? PHASE_COLOR.otro;
  const phase = PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind;
  // in a project row the project is already the row label: lead with the phase (or a custom title)
  const autoTitle = s.title === `${phase} · ${s.projectName}`;
  const heading = inProjectRow ? (autoTitle ? phase : s.title) : (s.projectName ?? s.title);
  const showPhase = !(inProjectRow && autoTitle);
  return (
    <button
      type="button"
      onClick={onClick}
      {...drag}
      title={`${s.projectName ?? s.title} · ${s.title} · ${formatTime(s.start)}–${formatTime(s.end)}${s.published ? "" : " · sin publicar"}`}
      className={cn(
        "flex h-full w-full min-w-0 flex-col justify-center overflow-hidden rounded-md border py-1 pl-2 pr-1.5 text-left text-[11px] leading-tight shadow-xs transition-shadow hover:shadow-md",
        drag && "cursor-grab active:cursor-grabbing",
        uncovered && "border-dashed border-warning",
        status === "rechazado" && "opacity-50 line-through",
        !s.published && "border-dashed",
      )}
      style={{ borderLeft: `3px solid ${color}`, background: `color-mix(in oklab, ${color} ${s.published ? 14 : 6}%, var(--card))` }}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <span className="truncate font-semibold">{heading}</span>
        {label && <span className={cn("ml-auto shrink-0 rounded bg-background/70 px-1 text-[10px] font-medium tabular", uncovered && "text-warning")}>{label}</span>}
        {status === "confirmado" && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-success" aria-label="Confirmado" />}
      </span>
      <span className="flex w-full min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
        <span className="shrink-0 tabular">
          {formatTime(s.start)}–{formatTime(s.end)}
        </span>
        {showPhase && <span className="truncate">· {phase}</span>}
      </span>
    </button>
  );
}

function CrewView({ data, shifts, crewOf, onOpen }: { data: BoardData; shifts: BoardShift[]; crewOf: (id: string) => BoardData["assignments"]; onOpen: (id: string) => void }) {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4 md:p-6">
      {data.range.days.map((d) => {
        const list = shifts.filter((s) => s.start < d.end && s.end > d.start).sort((a, b) => a.start - b.start);
        if (!list.length) return null;
        return (
          <section key={d.key}>
            <h2 className="mb-2 text-sm font-semibold capitalize">{d.label}</h2>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((s) => {
                const crew = crewOf(s.id);
                const vehicle = data.vehicles.find((v) => v.id === s.vehicleId);
                return (
                  <button key={s.id} onClick={() => onOpen(s.id)} className="rounded-xl border bg-card p-3 text-left hover:bg-subtle" style={{ borderLeft: `3px solid ${PHASE_COLOR[s.phaseKind] ?? "#6b6b68"}` }}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind}</span>
                      <span className="text-muted-foreground tabular">
                        {formatTime(s.start)}–{formatTime(s.end)}
                      </span>
                      <StatusPill className="ml-auto" tone={crew.length >= s.requiredPeople ? "success" : "warning"}>
                        {crew.length}/{s.requiredPeople}
                      </StatusPill>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{s.projectName ?? s.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {crew.map((a) => {
                        const w = data.workers.find((x) => x.id === a.workerId);
                        return w ? (
                          <span key={a.workerId} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
                            <span className="size-1.5 rounded-full" style={{ background: w.color ?? "#999" }} /> {w.name.split(" ")[0]}
                          </span>
                        ) : null;
                      })}
                    </div>
                    {vehicle && (
                      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Truck className="size-3" /> {vehicle.name}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ShiftSheet({ shift, data, crew, onClose, onAssign }: { shift: BoardShift; data: BoardData; crew: BoardData["assignments"]; onClose: () => void; onAssign: (workerId: string) => void }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [suggestions, setSuggestions] = useState<{ workerId: string; name: string; score: number; reasons: string[]; conflicts: Conflict[]; recommended: boolean }[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const all = data.assignments.filter((a) => a.shiftId === shift.id);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={shift.title} description={`${formatDate(shift.start, { weekday: "long", day: "numeric", month: "long" })} · ${formatTime(shift.start)}–${formatTime(shift.end)}`}>
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Info label="Fase" value={PHASE_LABELS[shift.phaseKind as PhaseKind] ?? shift.phaseKind} />
          <Info label="Personas" value={`${crew.length} de ${shift.requiredPeople}`} />
          <Info label="Proyecto" value={shift.projectId ? <Link className="text-link hover:underline" href={`/app/proyectos/${shift.projectId}`}>{shift.projectName}</Link> : "—"} />
          <Info label="Estado" value={shift.published ? <StatusPill tone="success">Publicado</StatusPill> : <StatusPill>Borrador</StatusPill>} />
          <Info label="Lugar" value={shift.address ?? "—"} />
          <Info label="Habilidades" value={shift.requiredSkills.map((s) => SKILL_LABELS[s as Skill] ?? s).join(", ") || "—"} />
        </div>
        {shift.notes && <p className="rounded-lg bg-subtle p-3 text-muted-foreground">{shift.notes}</p>}

        <div>
          <Field label="Vehículo" htmlFor="sh-veh">
            <NativeSelect
              id="sh-veh"
              disabled={!data.canEdit || busy}
              value={shift.vehicleId ?? ""}
              onChange={(e) =>
                start(async () => {
                  const r = await assignVehicle({ shiftId: shift.id, vehicleId: e.target.value || null });
                  if (!r.ok) toast.error(r.error);
                  router.refresh();
                })
              }
            >
              <option value="">Sin vehículo</option>
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {SKILL_LABELS[v.licence as Skill] ?? v.licence}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <section>
          <h3 className="mb-2 flex items-center gap-2 font-medium">
            <Users className="size-4" /> Cuadrilla
          </h3>
          {all.length === 0 && <p className="text-muted-foreground">Nadie asignado todavía.</p>}
          <ul className="divide-y rounded-lg border">
            {all.map((a) => {
              const w = data.workers.find((x) => x.id === a.workerId);
              return (
                <li key={a.workerId} className="flex items-center gap-2 px-3 py-2">
                  <WorkerDot color={w?.color ?? null} name={w?.name ?? "?"} />
                  <span className="flex-1">
                    {w?.name}
                    {a.overrideReason && <span className="block text-[11px] text-muted-foreground">{a.overrideReason}</span>}
                  </span>
                  <StatusPill tone={ASSIGNMENT_TONE[a.status] ?? "neutral"}>{ASSIGNMENT_LABEL[a.status] ?? a.status}</StatusPill>
                  {data.canEdit && (
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-accent"
                      aria-label={`Quitar a ${w?.name}`}
                      onClick={() =>
                        start(async () => {
                          const r = await unassignWorker({ shiftId: shift.id, workerId: a.workerId });
                          if (!r.ok) toast.error(r.error);
                          router.refresh();
                        })
                      }
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {data.canEdit && (
            <div className="mt-3 flex gap-2">
              <NativeSelect aria-label="Añadir trabajador" value={manual} onChange={(e) => setManual(e.target.value)}>
                <option value="">Añadir trabajador…</option>
                {data.workers
                  .filter((w) => !all.some((a) => a.workerId === w.id))
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </NativeSelect>
              <Button variant="outline" disabled={!manual} onClick={() => (onAssign(manual), setManual(""))}>
                Añadir
              </Button>
            </div>
          )}
        </section>

        {data.canEdit && (
          <section className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await suggestForShift({ shiftId: shift.id });
                  if (!r.ok) return void toast.error(r.error);
                  setSuggestions(r.data.suggestions);
                  setPicked(r.data.suggestions.filter((s) => s.recommended).map((s) => s.workerId));
                })
              }
            >
              <Sparkles /> Sugerir cuadrilla
            </Button>
            {suggestions && (
              <div className="space-y-2">
                <ul className="divide-y rounded-lg border">
                  {suggestions.map((s) => (
                    <li key={s.workerId} className="flex items-start gap-2 px-3 py-2">
                      <Checkbox className="mt-0.5" checked={picked.includes(s.workerId)} disabled={hasBlockingConflict(s.conflicts)} onCheckedChange={(c) => setPicked((p) => (c ? [...p, s.workerId] : p.filter((x) => x !== s.workerId)))} aria-label={s.name} />
                      <span className="flex-1">
                        <span className="font-medium">{s.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{s.reasons.join(" · ")}</span>
                        {s.conflicts.map((c, i) => (
                          <span key={i} className={cn("block text-[11px]", c.severity === "error" ? "text-danger" : "text-warning")}>
                            {c.message}
                          </span>
                        ))}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">{s.score}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  disabled={busy || picked.length === 0}
                  onClick={() =>
                    start(async () => {
                      let ok = 0;
                      for (const w of picked) {
                        const r = await assignWorker({ shiftId: shift.id, workerId: w });
                        if (r.ok) ok++;
                        else toast.error(r.error);
                      }
                      if (ok) toast.success(`${ok} asignado${ok === 1 ? "" : "s"}`);
                      setSuggestions(null);
                      router.refresh();
                    })
                  }
                >
                  Asignar seleccionados ({picked.length})
                </Button>
              </div>
            )}
          </section>
        )}
        {data.canEdit && (
          <Button
            variant="ghost"
            className="text-danger"
            disabled={busy}
            onClick={() =>
              start(async () => {
                if (!confirm("¿Eliminar este turno y sus asignaciones?")) return;
                const r = await deleteShift({ id: shift.id });
                if (!r.ok) return void toast.error(r.error);
                onClose();
                router.refresh();
              })
            }
          >
            Eliminar turno
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function PublishDialog({ range, onClose, count, unpublished }: { range: BoardRange; onClose: () => void; count: number; unpublished: number }) {
  const router = useRouter();
  const [channels, setChannels] = useState<("push" | "email" | "whatsapp")[]>(["push", "email"]);
  const [busy, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Publicar planning</DialogTitle>
          <DialogDescription>
            {count} turnos en el periodo ({unpublished} sin publicar). Cada trabajador recibirá un aviso con sus turnos y podrá confirmarlos desde la app.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {(
            [
              ["push", "Notificación push"],
              ["email", "Correo"],
              ["whatsapp", "WhatsApp"],
            ] as const
          ).map(([c, l]) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <Checkbox checked={channels.includes(c)} onCheckedChange={(v) => setChannels((x) => (v ? [...x, c] : x.filter((y) => y !== c)))} /> {l}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || channels.length === 0 || count === 0}
            onClick={() =>
              start(async () => {
                const r = await publishPlanning({ from: new Date(range.start), to: new Date(range.end), channels });
                if (!r.ok) return void toast.error(r.error);
                toast.success(`Publicados ${r.data.shifts} turnos · ${r.data.notifications} avisos enviados`);
                onClose();
                router.refresh();
              })
            }
          >
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewShiftDialog({ data, onClose }: { data: BoardData; onClose: () => void }) {
  const router = useRouter();
  const day = data.range.days[0]!.key;
  const [v, setV] = useState({ title: "", phaseKind: "montaje" as "carga" | "transporte" | "montaje" | "desmontaje" | "retorno" | "otro", date: day, from: "08:00", to: "16:00", requiredPeople: 4, projectId: "", vehicleId: "", address: "", skills: ["montador"] as string[] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo turno</DialogTitle>
          <DialogDescription>Para trabajos fuera de un proyecto o refuerzos puntuales.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Título" htmlFor="ns-t" error={errors.title}>
            <Input id="ns-t" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="p. ej. Revisión de lonas en nave" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fecha" htmlFor="ns-d">
              <Input id="ns-d" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
            </Field>
            <Field label="Desde" htmlFor="ns-f">
              <Input id="ns-f" type="time" value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} />
            </Field>
            <Field label="Hasta" htmlFor="ns-to" error={errors.endsAt}>
              <Input id="ns-to" type="time" value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fase" htmlFor="ns-p">
              <NativeSelect id="ns-p" value={v.phaseKind} onChange={(e) => setV({ ...v, phaseKind: e.target.value as typeof v.phaseKind })}>
                {(["carga", "transporte", "montaje", "desmontaje", "retorno"] as const).map((p) => (
                  <option key={p} value={p}>
                    {PHASE_LABELS[p]}
                  </option>
                ))}
                <option value="otro">Otro</option>
              </NativeSelect>
            </Field>
            <Field label="Personas" htmlFor="ns-n">
              <Input id="ns-n" type="number" min={1} max={40} value={v.requiredPeople} onChange={(e) => setV({ ...v, requiredPeople: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Proyecto" htmlFor="ns-pr">
            <NativeSelect id="ns-pr" value={v.projectId} onChange={(e) => setV({ ...v, projectId: e.target.value })}>
              <option value="">Sin proyecto</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Vehículo" htmlFor="ns-v">
            <NativeSelect id="ns-v" value={v.vehicleId} onChange={(e) => setV({ ...v, vehicleId: e.target.value })}>
              <option value="">Sin vehículo</option>
              {data.vehicles.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Lugar" htmlFor="ns-a">
            <Input id="ns-a" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Habilidades necesarias</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {SKILLS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={v.skills.includes(k)} onCheckedChange={(c) => setV({ ...v, skills: c ? [...v.skills, k] : v.skills.filter((x) => x !== k) })} />
                  {SKILL_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await saveShift({
                  title: v.title,
                  phaseKind: v.phaseKind,
                  startsAt: new Date(`${v.date}T${v.from}:00`),
                  endsAt: new Date(`${v.date}T${v.to}:00`),
                  requiredPeople: v.requiredPeople,
                  requiredSkills: v.skills,
                  vehicleId: v.vehicleId || null,
                  projectId: v.projectId || null,
                  address: v.address,
                  notes: null,
                });
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  return void toast.error(r.error);
                }
                toast.success("Turno creado");
                onClose();
                router.refresh();
              })
            }
          >
            Crear turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
