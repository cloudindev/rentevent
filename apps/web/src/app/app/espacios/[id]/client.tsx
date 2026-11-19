"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { deleteVenue } from "@/server/actions/venues";
import { VenueSheet, type VenueForm } from "../venue-form";

export function VenueActions({ initial, contacts }: { initial: VenueForm; contacts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-danger"
        disabled={busy}
        onClick={() =>
          start(async () => {
            if (!confirm("¿Eliminar este espacio? Los proyectos que lo usan quedarán sin espacio.")) return;
            const r = await deleteVenue({ id: initial.id! });
            if (!r.ok) return void toast.error(r.error);
            router.push("/app/espacios");
          })
        }
      >
        Eliminar
      </Button>
      {open && <VenueSheet initial={initial} contacts={contacts} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PlanUpload({ venueId, metresPerPixel }: { venueId: string; metresPerPixel: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mpp, setMpp] = useState(metresPerPixel ? String(metresPerPixel) : "");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload /> Subir plano
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Plano del recinto</DialogTitle>
            <DialogDescription>Imagen PNG, JPG o WebP de hasta 8 MB. Indica cuántos metros representa un píxel para dibujar las carpas a escala.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Archivo" htmlFor="plan-f">
              <Input id="plan-f" ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="py-1.5" />
            </Field>
            <Field label="Metros por píxel" htmlFor="plan-m" hint="p. ej. 0,05 si 20 px = 1 m">
              <Input id="plan-m" inputMode="decimal" value={mpp} onChange={(e) => setMpp(e.target.value.replace(",", "."))} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const f = file.current?.files?.[0];
                if (!f) return void toast.error("Elige un archivo");
                setBusy(true);
                const fd = new FormData();
                fd.set("file", f);
                fd.set("metresPerPixel", mpp);
                const res = await fetch(`/app/espacios/${venueId}/plano`, { method: "POST", body: fd });
                setBusy(false);
                const j = (await res.json()) as { error?: string };
                if (!res.ok) return void toast.error(j.error ?? "No se pudo subir");
                toast.success("Plano actualizado");
                setOpen(false);
                router.refresh();
              }}
            >
              {busy ? "Subiendo…" : "Subir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
