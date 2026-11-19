"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { saveVenue } from "@/server/actions/venues";

export const GROUND_LABELS: Record<string, string> = { cesped: "Césped", tierra: "Tierra", asfalto: "Asfalto", hormigon: "Hormigón", adoquin: "Adoquín", arena: "Arena", grava: "Grava", otro: "Otro" };

export type VenueForm = {
  id?: string | null;
  name: string;
  address: string;
  city: string;
  contactId: string | null;
  groundType: "cesped" | "tierra" | "asfalto" | "hormigon" | "adoquin" | "arena" | "grava" | "otro";
  anchoringAllowed: boolean;
  accessNotes: string;
  restrictions: string;
  maxVehicle: string;
  metresPerPixel: number | null;
};
export const EMPTY_VENUE: VenueForm = { name: "", address: "", city: "", contactId: null, groundType: "cesped", anchoringAllowed: true, accessNotes: "", restrictions: "", maxVehicle: "", metresPerPixel: null };

export function VenueSheet({ initial, contacts, onClose }: { initial: VenueForm; contacts: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, start] = useTransition();
  const set = <K extends keyof VenueForm>(k: K, val: VenueForm[K]) => setV((x) => ({ ...x, [k]: val }));
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={initial.id ? "Editar espacio" : "Nuevo espacio"} description="Recinto o localización de montaje">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveVenue(v);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              return void toast.error(r.error);
            }
            toast.success(r.data.geocoded ? `Espacio guardado · ubicación ${r.data.geocoded}` : "Espacio guardado");
            onClose();
            if (!initial.id) router.push(`/app/espacios/${r.data.id}`);
            else router.refresh();
          });
        }}
      >
        <Field label="Nombre" htmlFor="ve-n" error={errors.name}>
          <Input id="ve-n" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Finca La Quintana" />
        </Field>
        <Field label="Dirección" htmlFor="ve-a">
          <Input id="ve-a" value={v.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Municipio" htmlFor="ve-c">
          <Input id="ve-c" value={v.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Contacto propietario" htmlFor="ve-ct">
          <NativeSelect id="ve-ct" value={v.contactId ?? ""} onChange={(e) => set("contactId", e.target.value || null)}>
            <option value="">Sin contacto</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de suelo" htmlFor="ve-g">
            <NativeSelect id="ve-g" value={v.groundType} onChange={(e) => set("groundType", e.target.value as VenueForm["groundType"])}>
              {Object.entries(GROUND_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Vehículo máximo" htmlFor="ve-mv">
            <Input id="ve-mv" value={v.maxVehicle} onChange={(e) => set("maxVehicle", e.target.value)} placeholder="Camión 12 t" />
          </Field>
        </div>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <Switch checked={v.anchoringAllowed} onCheckedChange={(c) => set("anchoringAllowed", c)} />
          <span>
            Se permite anclar al suelo
            <span className="block text-xs text-muted-foreground">Si no, las carpas deben montarse con pesos.</span>
          </span>
        </label>
        <Field label="Accesos" htmlFor="ve-ac">
          <Textarea id="ve-ac" value={v.accessNotes} onChange={(e) => set("accessNotes", e.target.value)} placeholder="Horario de carga, puerta de entrada, pendiente…" />
        </Field>
        <Field label="Restricciones" htmlFor="ve-r">
          <Textarea id="ve-r" value={v.restrictions} onChange={(e) => set("restrictions", e.target.value)} placeholder="Ruido, horarios, permisos municipales…" />
        </Field>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Sheet>
  );
}
