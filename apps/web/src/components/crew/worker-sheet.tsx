"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SKILLS, SKILL_LABELS } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/menu";
import { saveWorker } from "@/server/actions/crew";

export type WorkerFormValue = {
  id?: string | null;
  name: string;
  email: string;
  phone: string;
  type: "plantilla" | "eventual" | "autonomo";
  skills: string[];
  trainingExpiresAt: string;
  costPerHour: number;
  weeklyHoursLimit: number;
  address: string;
  color: string;
  active: boolean;
};

export const EMPTY_WORKER: WorkerFormValue = { name: "", email: "", phone: "", type: "plantilla", skills: ["montador"], trainingExpiresAt: "", costPerHour: 18, weeklyHoursLimit: 40, address: "", color: "#2563eb", active: true };

export function WorkerSheet({ open, onOpenChange, initial, showCost }: { open: boolean; onOpenChange: (o: boolean) => void; initial: WorkerFormValue; showCost: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof WorkerFormValue>(k: K, val: WorkerFormValue[K]) => setV((x) => ({ ...x, [k]: val }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={initial.id ? "Editar trabajador" : "Nuevo trabajador"} description="Ficha, habilidades y formación en prevención">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveWorker(v);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
              return;
            }
            toast.success("Trabajador guardado");
            onOpenChange(false);
            router.refresh();
          });
        }}
      >
        <Field label="Nombre completo" htmlFor="w-name" error={errors.name}>
          <Input id="w-name" value={v.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Correo" htmlFor="w-email" error={errors.email}>
            <Input id="w-email" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Teléfono" htmlFor="w-phone">
            <Input id="w-phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" htmlFor="w-type">
            <NativeSelect id="w-type" value={v.type} onChange={(e) => set("type", e.target.value as WorkerFormValue["type"])}>
              <option value="plantilla">Plantilla</option>
              <option value="eventual">Eventual</option>
              <option value="autonomo">Autónomo</option>
            </NativeSelect>
          </Field>
          <Field label="Formación PRL caduca" htmlFor="w-training" error={errors.trainingExpiresAt}>
            <Input id="w-training" type="date" value={v.trainingExpiresAt} onChange={(e) => set("trainingExpiresAt", e.target.value)} />
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13px] font-medium">Habilidades</legend>
          <div className="grid grid-cols-2 gap-2">
            {SKILLS.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <Checkbox checked={v.skills.includes(s)} onCheckedChange={(c) => set("skills", c ? [...v.skills, s] : v.skills.filter((x) => x !== s))} />
                {SKILL_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          {showCost && (
            <Field label="Coste por hora (€)" htmlFor="w-cost" error={errors.costPerHour}>
              <Input id="w-cost" type="number" step="0.5" min={0} value={v.costPerHour} onChange={(e) => set("costPerHour", Number(e.target.value))} />
            </Field>
          )}
          <Field label="Límite semanal (h)" htmlFor="w-week" error={errors.weeklyHoursLimit}>
            <Input id="w-week" type="number" min={1} max={80} value={v.weeklyHoursLimit} onChange={(e) => set("weeklyHoursLimit", Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Domicilio (para sugerir cuadrillas por cercanía)" htmlFor="w-addr">
          <Input id="w-addr" value={v.address} onChange={(e) => set("address", e.target.value)} placeholder="Calle, municipio" />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <Field label="Color en el tablero" htmlFor="w-color">
            <Input id="w-color" type="color" className="h-9 w-16 p-1" value={v.color} onChange={(e) => set("color", e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={v.active} onCheckedChange={(c) => set("active", c)} /> Activo
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Sheet>
  );
}
