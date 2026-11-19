"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { addUnavailability, linkWorkerUser, removeUnavailability } from "@/server/actions/crew";

type Absence = { id: string; kind: string; startsAt: string; endsAt: string; note: string | null };
const KIND: Record<string, string> = { vacaciones: "Vacaciones", baja: "Baja", otro: "Otro" };

export function AbsencesCard({ workerId, items, canEdit }: { workerId: string; items: Absence[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "vacaciones" as "vacaciones" | "baja" | "otro", from: "", to: "", note: "" });
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vacaciones y bajas</CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus /> Añadir
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Sin ausencias registradas.</p>}
        {items.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <StatusPill tone={a.kind === "baja" ? "danger" : "warning"}>{KIND[a.kind] ?? a.kind}</StatusPill>
            <span className="flex-1 text-muted-foreground">
              {formatDate(a.startsAt, { day: "numeric", month: "short" })} – {formatDate(a.endsAt, { day: "numeric", month: "short", year: "numeric" })}
            </span>
            {canEdit && (
              <button
                className="rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label="Eliminar ausencia"
                onClick={() =>
                  start(async () => {
                    const r = await removeUnavailability({ id: a.id });
                    if (!r.ok) toast.error(r.error);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nueva ausencia</DialogTitle>
            <DialogDescription>El tablero avisará si se le asigna un turno en esas fechas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Tipo" htmlFor="ab-kind">
              <NativeSelect id="ab-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
                <option value="vacaciones">Vacaciones</option>
                <option value="baja">Baja</option>
                <option value="otro">Otro</option>
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desde" htmlFor="ab-from">
                <Input id="ab-from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
              </Field>
              <Field label="Hasta (incluido)" htmlFor="ab-to">
                <Input id="ab-to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
              </Field>
            </div>
            <Field label="Nota" htmlFor="ab-note">
              <Input id="ab-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !form.from || !form.to}
              onClick={() =>
                start(async () => {
                  const end = new Date(`${form.to}T00:00:00`);
                  end.setDate(end.getDate() + 1);
                  const r = await addUnavailability({ workerId, kind: form.kind, startsAt: new Date(`${form.from}T00:00:00`), endsAt: end, note: form.note });
                  if (!r.ok) return void toast.error(r.fieldErrors?.endsAt ?? r.error);
                  toast.success("Ausencia registrada");
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function LinkUserCard({ workerId, userId, members }: { workerId: string; userId: string | null; members: { id: string; name: string; email: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acceso a la app</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">Vincula la ficha con un usuario para que vea su agenda, fiche y rellene partes desde el móvil.</p>
        <NativeSelect
          aria-label="Usuario vinculado"
          disabled={pending}
          value={userId ?? ""}
          onChange={(e) =>
            start(async () => {
              const r = await linkWorkerUser({ workerId, userId: e.target.value || null });
              if (!r.ok) toast.error(r.error);
              else toast.success("Vinculación actualizada");
              router.refresh();
            })
          }
        >
          <option value="">Sin usuario</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.email}
            </option>
          ))}
        </NativeSelect>
      </CardContent>
    </Card>
  );
}
