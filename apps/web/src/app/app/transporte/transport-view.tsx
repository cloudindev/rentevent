"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, MapPin, Navigation, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { PHASE_LABELS, SKILL_LABELS, type PhaseKind, type Skill } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatDate, formatNumber, formatTime } from "@/lib/utils";
import { assignVehicle, saveVehicle } from "@/server/actions/transport";
import { shiftKey } from "@/server/crew/board";
import { nowMs } from "@/server/crew/hours";

type Vehicle = { id?: string | null; name: string; plate: string; kind: "camion" | "furgoneta" | "trailer" | "remolque" | "grua"; maxPayloadKg: number; volumeM3: number; licenceRequired: "conductor_b" | "conductor_c" | "conductor_ce"; itvUntil: string; costPerKm: number; active: boolean };
type Trip = {
  id: string;
  phase: string;
  title: string;
  start: string;
  end: string;
  project: string | null;
  order: string | null;
  destination: string | null;
  maxVehicle: string | null;
  lat: number | null;
  lng: number | null;
  vehicleId: string | null;
  load: { weightKg: number; volumeM3: number } | null;
  crew: { name: string; skills: string[] }[];
  notes: string | null;
};

const KIND_LABEL: Record<string, string> = { camion: "Camión", furgoneta: "Furgoneta", trailer: "Tráiler", remolque: "Remolque", grua: "Camión grúa" };
const EMPTY: Vehicle = { name: "", plate: "", kind: "camion", maxPayloadKg: 6000, volumeM3: 30, licenceRequired: "conductor_c", itvUntil: "", costPerKm: 0.9, active: true };

export function TransportView({ day, tab, fleet, trips, canEdit }: { day: string; tab: "rutas" | "vehiculos"; fleet: (Vehicle & { id: string })[]; trips: Trip[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [busy, start] = useTransition();
  const go = (p: Record<string, string>) => router.push(`/app/transporte?${new URLSearchParams({ fecha: day, tab, ...p })}`);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-lg border p-0.5">
          {(
            [
              ["rutas", "Rutas del día"],
              ["vehiculos", "Vehículos"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => go({ tab: k })} className={cn("rounded-md px-3 py-1 text-[13px] text-muted-foreground", tab === k && "bg-accent font-medium text-foreground")}>
              {l}
            </button>
          ))}
        </div>
        {tab === "rutas" && (
          <>
            <Button size="sm" variant="outline" onClick={() => go({ fecha: shiftKey(day, -1) })} aria-label="Día anterior">
              ‹
            </Button>
            <Input type="date" className="h-8 w-40" value={day} onChange={(e) => e.target.value && go({ fecha: e.target.value })} aria-label="Fecha" />
            <Button size="sm" variant="outline" onClick={() => go({ fecha: shiftKey(day, 1) })} aria-label="Día siguiente">
              ›
            </Button>
            {day !== today && (
              <Button size="sm" variant="ghost" onClick={() => go({ fecha: today })}>
                Hoy
              </Button>
            )}
          </>
        )}
        <div className="flex-1" />
        {tab === "vehiculos" && canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus /> Nuevo vehículo
          </Button>
        )}
      </div>

      {tab === "rutas" ? (
        trips.length === 0 ? (
          <EmptyState icon={Truck} title={`Sin cargas ni transportes el ${formatDate(`${day}T12:00:00`, { weekday: "long", day: "numeric", month: "long" })}`} description="Los turnos de carga, transporte y retorno de los proyectos aparecen aquí con su vehículo y conductor." />
        ) : (
          <ol className="space-y-3">
            {trips.map((t, i) => {
              const v = fleet.find((x) => x.id === t.vehicleId);
              const overW = v && t.load ? t.load.weightKg > v.maxPayloadKg : false;
              const overV = v && t.load ? t.load.volumeM3 > v.volumeM3 : false;
              const driver = v ? t.crew.find((c) => c.skills.includes(v.licenceRequired) || (v.licenceRequired === "conductor_c" && c.skills.includes("conductor_ce"))) : null;
              return (
                <li key={t.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="tabular">
                          {formatTime(t.start)}–{formatTime(t.end)}
                        </span>
                        <StatusPill tone={t.phase === "retorno" ? "info" : t.phase === "carga" ? "neutral" : "brand"}>{PHASE_LABELS[t.phase as PhaseKind] ?? t.phase}</StatusPill>
                        <span className="truncate">{t.project ?? t.title}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {t.phase === "carga" ? "Nave" : (t.destination ?? "Sin destino")}
                        {t.lat != null && t.lng != null && t.phase !== "carga" && (
                          <a className="ml-2 inline-flex items-center gap-1 text-link hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`}>
                            <Navigation className="size-3.5" /> Ruta
                          </a>
                        )}
                      </p>
                      {t.order && <p className="mt-0.5 text-xs text-muted-foreground">Pedido {t.order}</p>}
                      {t.maxVehicle && <p className="mt-0.5 text-xs text-warning">Acceso: {t.maxVehicle}</p>}
                      {t.notes && <p className="mt-0.5 text-xs text-muted-foreground">{t.notes}</p>}
                    </div>
                    <div className="w-full space-y-1.5 sm:w-72">
                      <NativeSelect
                        aria-label="Vehículo"
                        disabled={!canEdit || busy}
                        value={t.vehicleId ?? ""}
                        onChange={(e) =>
                          start(async () => {
                            const r = await assignVehicle({ shiftId: t.id, vehicleId: e.target.value || null });
                            if (!r.ok) toast.error(r.error);
                            router.refresh();
                          })
                        }
                      >
                        <option value="">Sin vehículo</option>
                        {fleet
                          .filter((x) => x.active)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name} · {x.plate}
                            </option>
                          ))}
                      </NativeSelect>
                      {t.load && (
                        <p className={cn("text-xs tabular", overW || overV ? "text-danger" : "text-muted-foreground")}>
                          Carga {formatNumber(t.load.weightKg)} kg · {formatNumber(t.load.volumeM3)} m³
                          {v && ` de ${formatNumber(v.maxPayloadKg)} kg · ${formatNumber(v.volumeM3)} m³`}
                        </p>
                      )}
                      {(overW || overV) && (
                        <p className="flex items-center gap-1 text-xs text-danger">
                          <AlertTriangle className="size-3.5" /> Supera la capacidad: {Math.max(Math.ceil(t.load!.weightKg / v!.maxPayloadKg), Math.ceil(t.load!.volumeM3 / v!.volumeM3))} viajes o un vehículo mayor
                        </p>
                      )}
                      {v && t.phase !== "carga" && (
                        <p className={cn("text-xs", driver ? "text-muted-foreground" : "text-warning")}>{driver ? `Conductor: ${driver.name}` : `Falta conductor con ${SKILL_LABELS[v.licenceRequired as Skill]}`}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{t.crew.length ? `Cuadrilla: ${t.crew.map((c) => c.name.split(" ")[0]).join(", ")}` : "Sin cuadrilla"}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )
      ) : fleet.length === 0 ? (
        <EmptyState icon={Truck} title="Aún no hay vehículos" description="Registra camiones y furgonetas con su carga útil y volumen para comprobar cada despiece." action={canEdit ? <Button onClick={() => setEditing({ ...EMPTY })}>Añadir vehículo</Button> : undefined} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Vehículo</TH>
              <TH>Tipo</TH>
              <TH className="text-right">Carga útil</TH>
              <TH className="text-right">Volumen</TH>
              <TH>Carné</TH>
              <TH>ITV</TH>
              <TH className="text-right">€/km</TH>
              <TH className="w-20" />
            </TR>
          </THead>
          <TBody>
            {fleet.map((v) => {
              const itvSoon = v.itvUntil && new Date(v.itvUntil) < new Date(nowMs() + 30 * 86_400_000);
              return (
                <TR key={v.id} className={v.active ? "" : "opacity-60"}>
                  <TD>
                    <span className="font-medium">{v.name}</span>
                    <span className="block text-xs text-muted-foreground">{v.plate}</span>
                  </TD>
                  <TD className="text-muted-foreground">{KIND_LABEL[v.kind] ?? v.kind}</TD>
                  <TD className="tabular text-right">{formatNumber(v.maxPayloadKg)} kg</TD>
                  <TD className="tabular text-right">{formatNumber(v.volumeM3)} m³</TD>
                  <TD>{SKILL_LABELS[v.licenceRequired as Skill] ?? v.licenceRequired}</TD>
                  <TD>{v.itvUntil ? <StatusPill tone={itvSoon ? (new Date(v.itvUntil) < new Date() ? "danger" : "warning") : "success"}>{formatDate(v.itvUntil)}</StatusPill> : "—"}</TD>
                  <TD className="tabular text-right">{v.costPerKm.toFixed(2)}</TD>
                  <TD className="text-right">
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                        Editar
                      </Button>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
      {editing && <VehicleSheet key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} />}
      {tab === "rutas" && (
        <p className="text-xs text-muted-foreground">
          Los turnos de transporte se generan desde cada <Link className="text-link hover:underline" href="/app/proyectos">proyecto</Link> y se asignan en el <Link className="text-link hover:underline" href="/app/personal/tablero">tablero de personal</Link>.
        </p>
      )}
    </div>
  );
}

function VehicleSheet({ initial, onClose }: { initial: Vehicle; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  const set = <K extends keyof Vehicle>(k: K, val: Vehicle[K]) => setV((x) => ({ ...x, [k]: val }));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={initial.id ? "Editar vehículo" : "Nuevo vehículo"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveVehicle(v);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              return void toast.error(r.error);
            }
            toast.success("Vehículo guardado");
            onClose();
            router.refresh();
          });
        }}
      >
        <Field label="Nombre" htmlFor="v-n" error={errors.name}>
          <Input id="v-n" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Camión grúa 12 t" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Matrícula" htmlFor="v-p">
            <Input id="v-p" value={v.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Tipo" htmlFor="v-k">
            <NativeSelect id="v-k" value={v.kind} onChange={(e) => set("kind", e.target.value as Vehicle["kind"])}>
              {Object.entries(KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Carga útil (kg)" htmlFor="v-w" error={errors.maxPayloadKg}>
            <Input id="v-w" type="number" min={1} value={v.maxPayloadKg} onChange={(e) => set("maxPayloadKg", Number(e.target.value))} />
          </Field>
          <Field label="Volumen (m³)" htmlFor="v-vol" error={errors.volumeM3}>
            <Input id="v-vol" type="number" min={0.1} step="0.1" value={v.volumeM3} onChange={(e) => set("volumeM3", Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Carné necesario" htmlFor="v-l">
            <NativeSelect id="v-l" value={v.licenceRequired} onChange={(e) => set("licenceRequired", e.target.value as Vehicle["licenceRequired"])}>
              <option value="conductor_b">B</option>
              <option value="conductor_c">C</option>
              <option value="conductor_ce">C+E</option>
            </NativeSelect>
          </Field>
          <Field label="ITV hasta" htmlFor="v-itv">
            <Input id="v-itv" type="date" value={v.itvUntil} onChange={(e) => set("itvUntil", e.target.value)} />
          </Field>
        </div>
        <Field label="Coste por km (€)" htmlFor="v-c">
          <Input id="v-c" type="number" step="0.01" min={0} value={v.costPerKm} onChange={(e) => set("costPerKm", Number(e.target.value))} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={v.active} onCheckedChange={(c) => set("active", c)} /> Activo
        </label>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy}>Guardar</Button>
        </div>
      </form>
    </Sheet>
  );
}
