"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Clock, MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { WorkerDot } from "@/components/crew/bits";
import { formatDate, formatTime, toLocalInput } from "@/lib/utils";
import { correctTimeEntry } from "@/server/actions/crew";
import type { DayRow } from "@/server/crew/hours";

type Entry = { id: string; workerId: string; shiftId: string | null; clockIn: string; clockOut: string | null; breakMinutes: number; diet: boolean; source: string; editReason: string | null; editedBy: string | null; hasGeo: boolean };
type Edit = { id: string | null; workerId: string; clockIn: string; clockOut: string; breakMinutes: number; diet: boolean; reason: string };

export function RegisterView({ month, workers, rows, entries, canEdit }: { month: string; workers: { id: string; name: string; color: string | null }[]; rows: DayRow[]; entries: Entry[]; canEdit: boolean }) {
  const router = useRouter();
  const [worker, setWorker] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, start] = useTransition();
  const name = (id: string) => workers.find((w) => w.id === id);
  const filtered = rows.filter((r) => !worker || r.workerId === worker);
  const totals = useMemo(() => {
    const t = new Map<string, { planned: number; real: number; overtime: number; diets: number; days: number }>();
    for (const r of filtered) {
      const x = t.get(r.workerId) ?? { planned: 0, real: 0, overtime: 0, diets: 0, days: 0 };
      x.planned += r.planned;
      x.real += r.real;
      x.overtime += r.overtime;
      x.diets += r.diets;
      x.days += r.real > 0 ? 1 : 0;
      t.set(r.workerId, x);
    }
    return [...t.entries()];
  }, [filtered]);

  const [y, m] = month.split("-").map(Number) as [number, number];
  const shift = (d: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1));
    router.push(`/app/personal/fichajes?mes=${dt.toISOString().slice(0, 7)}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => shift(-1)} aria-label="Mes anterior">
          ‹
        </Button>
        <span className="min-w-36 text-center text-sm font-medium capitalize">{formatDate(Date.UTC(y, m - 1, 15), { month: "long", year: "numeric" })}</span>
        <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="Mes siguiente">
          ›
        </Button>
        <NativeSelect className="w-56" value={worker} onChange={(e) => setWorker(e.target.value)} aria-label="Trabajador">
          <option value="">Todos los trabajadores</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </NativeSelect>
        <div className="flex-1" />
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEdit({ id: null, workerId: worker || workers[0]?.id || "", clockIn: `${month}-01T08:00`, clockOut: `${month}-01T16:00`, breakMinutes: 30, diet: false, reason: "" })}>
            <Plus /> Fichaje manual
          </Button>
        )}
      </div>

      {totals.length === 0 ? (
        <EmptyState icon={Clock} title="Sin fichajes ni turnos este mes" description="Los trabajadores fichan desde la app móvil; aquí verás las horas previstas frente a las reales." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Trabajador</TH>
              <TH className="text-right">Días</TH>
              <TH className="text-right">Previstas</TH>
              <TH className="text-right">Reales</TH>
              <TH className="text-right">Diferencia</TH>
              <TH className="text-right">Extra</TH>
              <TH className="text-right">Dietas</TH>
            </TR>
          </THead>
          <TBody>
            {totals.map(([id, t]) => {
              const diff = t.real - t.planned;
              return (
                <TR key={id}>
                  <TD>
                    <span className="flex items-center gap-2">
                      <WorkerDot color={name(id)?.color ?? null} name={name(id)?.name ?? "?"} /> {name(id)?.name}
                    </span>
                  </TD>
                  <TD className="tabular text-right">{t.days}</TD>
                  <TD className="tabular text-right">{t.planned.toFixed(2)}</TD>
                  <TD className="tabular text-right">{t.real.toFixed(2)}</TD>
                  <TD className={`tabular text-right ${Math.abs(diff) > 1 ? (diff > 0 ? "text-warning" : "text-danger") : ""}`}>{(diff > 0 ? "+" : "") + diff.toFixed(2)}</TD>
                  <TD className="tabular text-right">{t.overtime.toFixed(2)}</TD>
                  <TD className="tabular text-right">{t.diets}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Detalle de fichajes</h2>
        {entries.filter((e) => !worker || e.workerId === worker).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin fichajes.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Día</TH>
                <TH>Trabajador</TH>
                <TH>Entrada</TH>
                <TH>Salida</TH>
                <TH className="text-right">Pausa</TH>
                <TH>Origen</TH>
                <TH className="w-12" />
              </TR>
            </THead>
            <TBody>
              {entries
                .filter((e) => !worker || e.workerId === worker)
                .map((e) => (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap">{formatDate(e.clockIn, { weekday: "short", day: "numeric", month: "short" })}</TD>
                    <TD>{name(e.workerId)?.name}</TD>
                    <TD className="tabular">
                      {formatTime(e.clockIn)} {e.hasGeo && <MapPin className="inline size-3 text-muted-foreground" aria-label="Con geolocalización" />}
                    </TD>
                    <TD className="tabular">{e.clockOut ? formatTime(e.clockOut) : <StatusPill tone="warning">Abierto</StatusPill>}</TD>
                    <TD className="tabular text-right">{e.breakMinutes} min</TD>
                    <TD className="text-xs text-muted-foreground">{e.editReason ? `Corregido por ${e.editedBy}: ${e.editReason}` : e.source === "manual" ? "Manual" : e.source === "app_sin_conexion" ? "App (sin conexión)" : "App"}</TD>
                    <TD>
                      {canEdit && (
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-accent"
                          aria-label="Corregir fichaje"
                          onClick={() => setEdit({ id: e.id, workerId: e.workerId, clockIn: toLocalInput(e.clockIn), clockOut: e.clockOut ? toLocalInput(e.clockOut) : "", breakMinutes: e.breakMinutes, diet: e.diet, reason: "" })}
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}
                    </TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        )}
      </section>

      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="sm">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>{edit.id ? "Corregir fichaje" : "Fichaje manual"}</DialogTitle>
                <DialogDescription>Las correcciones quedan registradas con su motivo para la inspección de trabajo.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                {!edit.id && (
                  <Field label="Trabajador" htmlFor="te-w">
                    <NativeSelect id="te-w" value={edit.workerId} onChange={(e) => setEdit({ ...edit, workerId: e.target.value })}>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <Field label="Entrada" htmlFor="te-in">
                  <Input id="te-in" type="datetime-local" value={edit.clockIn} onChange={(e) => setEdit({ ...edit, clockIn: e.target.value })} />
                </Field>
                <Field label="Salida" htmlFor="te-out">
                  <Input id="te-out" type="datetime-local" value={edit.clockOut} onChange={(e) => setEdit({ ...edit, clockOut: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 items-end gap-3">
                  <Field label="Pausa (min)" htmlFor="te-b">
                    <Input id="te-b" type="number" min={0} value={edit.breakMinutes} onChange={(e) => setEdit({ ...edit, breakMinutes: Number(e.target.value) })} />
                  </Field>
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <Checkbox checked={edit.diet} onCheckedChange={(v) => setEdit({ ...edit, diet: v === true })} /> Dieta
                  </label>
                </div>
                <Field label="Motivo de la corrección" htmlFor="te-r">
                  <Input id="te-r" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="p. ej. olvidó fichar la salida" />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Cancelar
                </Button>
                <Button
                  disabled={busy || edit.reason.trim().length < 3}
                  onClick={() =>
                    start(async () => {
                      const r = await correctTimeEntry({ id: edit.id, workerId: edit.workerId, clockIn: new Date(edit.clockIn), clockOut: edit.clockOut ? new Date(edit.clockOut) : null, breakMinutes: edit.breakMinutes, diet: edit.diet, reason: edit.reason });
                      if (!r.ok) return void toast.error(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
                      toast.success("Fichaje guardado");
                      setEdit(null);
                      router.refresh();
                    })
                  }
                >
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
