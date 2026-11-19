"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LogIn, LogOut, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { formatDateTime, formatTime } from "@/lib/utils";
import { currentPosition, discardItem, listOutbox, runOrQueue, type OutboxItem } from "./outbox";

export function ClockPanel({ open, todayShifts }: { open: { clockIn: string; shiftTitle: string | null } | null; todayShifts: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [shiftId, setShiftId] = useState(todayShifts[0]?.id ?? "");
  const [breakMinutes, setBreak] = useState(30);
  const [diet, setDiet] = useState(false);
  const [queued, setQueued] = useState<OutboxItem[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const load = async () => setQueued(await listOutbox());
    load();
    window.addEventListener("rv-outbox", load);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.removeEventListener("rv-outbox", load);
      clearInterval(t);
    };
  }, []);

  const pendingIn = queued.find((q) => q.kind === "clockIn");
  const pendingOut = queued.find((q) => q.kind === "clockOut");
  const isOpen = (Boolean(open) || Boolean(pendingIn)) && !pendingOut;
  const since = open?.clockIn ?? (pendingIn?.kind === "clockIn" ? pendingIn.payload.at : null);
  const elapsed = since ? Math.max(0, now - new Date(since).getTime()) : 0;

  const act = (kind: "clockIn" | "clockOut") =>
    start(async () => {
      const pos = await currentPosition();
      const at = new Date().toISOString();
      const r = kind === "clockIn" ? await runOrQueue({ kind, payload: { shiftId: shiftId || null, ...pos, at } }) : await runOrQueue({ kind, payload: { ...pos, at, breakMinutes, diet } });
      if (r.status === "error") return void toast.error(r.error);
      toast.success(r.status === "queued" ? "Sin conexión: fichaje guardado en el móvil" : kind === "clockIn" ? `Entrada registrada${pos.lat ? " con ubicación" : ""}` : "Salida registrada");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-background p-5 text-center">
        <p className="text-sm text-muted-foreground">{isOpen ? "Jornada en curso" : "Fuera de jornada"}</p>
        <p className="mt-1 text-4xl font-semibold tabular">{isOpen ? `${Math.floor(elapsed / 3_600_000)}:${String(Math.floor((elapsed % 3_600_000) / 60_000)).padStart(2, "0")}` : "--:--"}</p>
        {isOpen && since && (
          <p className="mt-1 text-sm text-muted-foreground">
            Desde las {formatTime(since)}
            {open?.shiftTitle ? ` · ${open.shiftTitle}` : ""}
          </p>
        )}
        <div className="mt-5 space-y-3 text-left">
          {!isOpen ? (
            <>
              {todayShifts.length > 0 && (
                <Field label="Turno" htmlFor="ck-shift">
                  <NativeSelect id="ck-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                    {todayShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                    <option value="">Sin turno (trabajo en nave)</option>
                  </NativeSelect>
                </Field>
              )}
              <Button className="h-14 w-full text-base" disabled={busy} onClick={() => act("clockIn")}>
                <LogIn className="size-5" /> Fichar entrada
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Pausa (min)" htmlFor="ck-b">
                  <Input id="ck-b" type="number" inputMode="numeric" min={0} value={breakMinutes} onChange={(e) => setBreak(Number(e.target.value))} />
                </Field>
                <label className="flex h-9 items-center gap-2 text-sm">
                  <Checkbox checked={diet} onCheckedChange={(v) => setDiet(v === true)} /> Dieta
                </label>
              </div>
              <Button className="h-14 w-full text-base" variant="dark" disabled={busy} onClick={() => act("clockOut")}>
                <LogOut className="size-5" /> Fichar salida
              </Button>
            </>
          )}
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> Se guarda tu ubicación al fichar (registro horario obligatorio).
          </p>
        </div>
      </section>
      {queued.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Pendiente de enviar</h2>
          <ul className="divide-y rounded-xl border bg-background text-sm">
            {queued.map((q) => (
              <li key={q.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1">
                  {{ clockIn: "Entrada", clockOut: "Salida", photo: "Foto", report: "Parte de trabajo" }[q.kind]} · {formatDateTime(q.createdAt)}
                  {q.error && <span className="block text-xs text-danger">{q.error}</span>}
                </span>
                {q.error && (
                  <button className="rounded p-1 text-muted-foreground" aria-label="Descartar" onClick={() => discardItem(q.id)}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
