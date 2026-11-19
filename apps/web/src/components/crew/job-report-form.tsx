"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Camera, Check, Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { compressImage, currentPosition, newLocalId, runOrQueue, type PhotoRef } from "./outbox";
import { SignaturePad } from "./signature-pad";

type Photo = PhotoRef & { preview: string };

export function ClockForShift({ shiftId, openHere, openElsewhere }: { shiftId: string; openHere: boolean; openElsewhere: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const act = (kind: "clockIn" | "clockOut") =>
    start(async () => {
      const pos = await currentPosition();
      const at = new Date().toISOString();
      const r = kind === "clockIn" ? await runOrQueue({ kind, payload: { shiftId, ...pos, at } }) : await runOrQueue({ kind, payload: { ...pos, at, breakMinutes: 0, diet: false } });
      if (r.status === "error") return void toast.error(r.error);
      toast.success(r.status === "queued" ? "Sin conexión: fichaje guardado, se enviará al recuperar cobertura" : kind === "clockIn" ? "Entrada registrada" : "Salida registrada");
      router.refresh();
    });
  if (openElsewhere && !openHere) return <p className="text-sm text-muted-foreground">Tienes una jornada abierta en otro turno. Ficha la salida desde Fichar.</p>;
  return openHere ? (
    <Button className="w-full" size="lg" variant="dark" disabled={busy} onClick={() => act("clockOut")}>
      <LogOut /> Fichar salida
    </Button>
  ) : (
    <Button className="w-full" size="lg" disabled={busy} onClick={() => act("clockIn")}>
      <LogIn /> Fichar entrada en este turno
    </Button>
  );
}

export function JobReportForm({
  shiftId,
  initial,
  fileBase,
}: {
  shiftId: string;
  initial: { clientRef: string; checklist: { label: string; done: boolean }[]; incidents: string; clientName: string; signature: string | null; photos: { key: string; stage: "inicio" | "fin" }[]; completed: boolean };
  fileBase: string;
}) {
  const router = useRouter();
  const draftKey = `rv-report-${shiftId}`;
  const [checklist, setChecklist] = useState(initial.checklist);
  const [incidents, setIncidents] = useState(initial.incidents);
  const [clientName, setClientName] = useState(initial.clientName);
  const [signature, setSignature] = useState<string | null>(initial.signature);
  const [photos, setPhotos] = useState<Photo[]>(initial.photos.map((p) => ({ ...p, preview: `${fileBase}/${p.key.split("/").map(encodeURIComponent).join("/")}` })));
  const [busy, start] = useTransition();
  const clientRef = useMemo(() => initial.clientRef, [initial.clientRef]);

  // keep an offline draft of text fields
  useEffect(() => {
    let draft: { checklist?: { label: string; done: boolean }[]; incidents?: string; clientName?: string } | null = null;
    try {
      const d = localStorage.getItem(draftKey);
      if (d && !initial.completed) draft = JSON.parse(d);
    } catch {
      /* storage unavailable */
    }
    if (!draft) return;
    const j = draft;
    // restore after hydration (async to avoid a cascading synchronous render)
    void Promise.resolve().then(() => {
      if (j.checklist?.length) setChecklist(j.checklist);
      if (j.incidents) setIncidents(j.incidents);
      if (j.clientName) setClientName(j.clientName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ checklist, incidents, clientName }));
    } catch {
      /* storage unavailable */
    }
  }, [draftKey, checklist, incidents, clientName]);

  async function addPhoto(stage: "inicio" | "fin", file: File | undefined) {
    if (!file) return;
    const blob = await compressImage(file);
    const localId = newLocalId();
    const preview = URL.createObjectURL(blob);
    const fd = new FormData();
    fd.set("file", blob, `${stage}.jpg`);
    fd.set("shiftId", shiftId);
    fd.set("stage", stage);
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      const res = await fetch("/m/foto", { method: "POST", body: fd });
      const j = (await res.json()) as { key?: string; error?: string };
      if (!res.ok || !j.key) return void toast.error(j.error ?? "No se pudo subir la foto");
      setPhotos((p) => [...p, { key: j.key, stage, preview }]);
    } catch {
      await runOrQueue({ kind: "photo", payload: { localId, shiftId, stage, blob } });
      setPhotos((p) => [...p, { localId, stage, preview }]);
      toast.info("Foto guardada en el móvil; se subirá al recuperar cobertura");
    }
  }

  const submit = (complete: boolean) =>
    start(async () => {
      if (complete && !signature) return void toast.error("Falta la firma del cliente");
      const r = await runOrQueue({
        kind: "report",
        payload: { shiftId, clientRef, checklist, incidents: incidents || null, clientName: clientName || null, clientSignature: signature, photos: photos.map(({ key, localId, stage }) => ({ key, localId, stage })), complete },
      });
      if (r.status === "error") return void toast.error(r.error);
      if (complete)
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      toast.success(r.status === "queued" ? "Parte guardado sin conexión; se enviará automáticamente" : complete ? "Parte enviado" : "Borrador guardado");
      router.refresh();
    });

  const done = checklist.filter((c) => c.done).length;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="flex items-center justify-between text-sm font-semibold">
          Lista de comprobación <span className="text-xs font-normal text-muted-foreground tabular">{done}/{checklist.length}</span>
        </h2>
        <ul className="divide-y rounded-xl border bg-background">
          {checklist.map((c, i) => (
            <li key={c.label}>
              <label className="flex min-h-12 items-center gap-3 px-4 text-sm">
                <Checkbox checked={c.done} onCheckedChange={(v) => setChecklist((l) => l.map((x, j) => (j === i ? { ...x, done: v === true } : x)))} />
                <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Fotos</h2>
        <div className="grid grid-cols-2 gap-2">
          {(["inicio", "fin"] as const).map((stage) => (
            <label key={stage} className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-background text-sm text-muted-foreground">
              <Camera className="size-5" /> Foto de {stage}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhoto(stage, e.target.files?.[0])} />
            </label>
          ))}
        </div>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <figure key={p.key ?? p.localId ?? i} className="relative overflow-hidden rounded-lg border">
                <img src={p.preview} alt={`Foto de ${p.stage}`} className="aspect-square w-full object-cover" />
                <figcaption className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
                  {p.stage}
                  {!p.key && " · pendiente"}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <Field label="Incidencias" htmlFor="jr-inc">
        <Textarea id="jr-inc" value={incidents} onChange={(e) => setIncidents(e.target.value)} placeholder="Daños, material que falta, cambios pedidos por el cliente…" />
      </Field>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="text-sm font-semibold">Conformidad del cliente</h2>
        <Field label="Nombre de quien firma" htmlFor="jr-cn">
          <Input id="jr-cn" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </Field>
        <SignaturePad value={signature} onChange={setSignature} label="Firma del cliente" />
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" disabled={busy} onClick={() => submit(false)}>
          <Clock /> Guardar
        </Button>
        <Button size="lg" disabled={busy} onClick={() => submit(true)}>
          <Check /> {initial.completed ? "Reenviar parte" : "Enviar parte"}
        </Button>
      </div>
    </div>
  );
}
