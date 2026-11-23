"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PART_ROLES, type PartRole } from "@rentevent/core";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { saveItem } from "@/server/actions/inventory";

export type ItemFormValues = {
  id: string | null;
  sku: string;
  name: string;
  category: string;
  kind: "granel" | "seriado" | "consumible" | "servicio";
  unit: "ud" | "m2" | "m" | "ml" | "rollo" | "kg";
  role: PartRole;
  roleAmount: number;
  weightKg: number;
  volumeM3: number;
  price: number;
  priceMode: "unidad" | "dia" | "periodo" | "m2" | "ml" | "incluido" | "hora" | "km";
  costPrice: number;
  replacementCost: number;
  stockTotal: number;
  location: string | null;
  description: string | null;
  inspectionIntervalDays: number | null;
  active: boolean;
  container?: "caja" | "conjunto" | null;
};

const EMPTY: ItemFormValues = { id: null, sku: "", name: "", category: "General", kind: "granel", unit: "ud", role: "otro", roleAmount: 1, weightKg: 0, volumeM3: 0, price: 0, priceMode: "unidad", costPrice: 0, replacementCost: 0, stockTotal: 0, location: null, description: null, inspectionIntervalDays: null, active: true };

const ROLE_LABELS: Partial<Record<PartRole, string>> = { otro: "Otro (no se dibuja)", cercha: "Cercha", pilar: "Pilar", lona_techo_blanca: "Lona techo blanca", lona_techo_transparente: "Lona techo transparente" };

export function ItemSheet({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: ItemFormValues }) {
  const router = useRouter();
  const [v, setV] = useState<ItemFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof ItemFormValues>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((x) => ({ ...x, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value }));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={v.id ? "Editar artículo" : "Nuevo artículo"} className="max-w-lg">
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveItem(v);
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
              return;
            }
            toast.success("Artículo guardado");
            onOpenChange(false);
            if (!v.id) router.push(`/app/inventario/${r.data.id}`);
            else router.refresh();
          });
        }}
      >
        <Field label="SKU" htmlFor="it-sku" error={errors.sku}>
          <Input id="it-sku" value={v.sku} onChange={set("sku")} />
        </Field>
        <Field label="Categoría" htmlFor="it-cat">
          <Input id="it-cat" value={v.category} onChange={set("category")} />
        </Field>
        <Field label="Nombre" htmlFor="it-name" error={errors.name} className="col-span-2">
          <Input id="it-name" value={v.name} onChange={set("name")} />
        </Field>
        <Field label="Tipo" htmlFor="it-kind">
          <NativeSelect id="it-kind" value={v.kind} onChange={set("kind")}>
            <option value="granel">A granel (por cantidad)</option>
            <option value="seriado">Seriado (QR por unidad)</option>
            <option value="consumible">Consumible</option>
            <option value="servicio">Servicio (sin control de stock)</option>
          </NativeSelect>
        </Field>
        <Field label="Unidad" htmlFor="it-unit">
          <NativeSelect id="it-unit" value={v.unit} onChange={set("unit")}>
            {["ud", "m2", "m", "ml", "rollo", "kg"].map((u) => (
              <option key={u} value={u}>
                {u === "m2" ? "m²" : u}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Stock total" htmlFor="it-stock">
          <Input id="it-stock" type="number" min={0} value={v.stockTotal} onChange={set("stockTotal")} />
        </Field>
        <Field label="Ubicación" htmlFor="it-loc">
          <Input id="it-loc" value={v.location ?? ""} onChange={set("location")} placeholder="A-01" />
        </Field>
        <Field label="Tarifa" htmlFor="it-price">
          <Input id="it-price" type="number" step="0.01" min={0} value={v.price} onChange={set("price")} />
        </Field>
        <Field label="Modo de tarifa" htmlFor="it-pm">
          <NativeSelect id="it-pm" value={v.priceMode} onChange={set("priceMode")}>
            <option value="unidad">Por unidad</option>
            <option value="dia">Por día</option>
            <option value="periodo">Por periodo</option>
            <option value="m2">Por m²</option>
            <option value="ml">Por metro lineal</option>
            <option value="incluido">Incluido en la carpa</option>
          </NativeSelect>
        </Field>
        <Field label="Coste" htmlFor="it-cost">
          <Input id="it-cost" type="number" step="0.01" min={0} value={v.costPrice} onChange={set("costPrice")} />
        </Field>
        <Field label="Valor de reposición" htmlFor="it-rep">
          <Input id="it-rep" type="number" step="0.01" min={0} value={v.replacementCost} onChange={set("replacementCost")} />
        </Field>
        <Field label="Peso (kg)" htmlFor="it-w">
          <Input id="it-w" type="number" step="0.1" min={0} value={v.weightKg} onChange={set("weightKg")} />
        </Field>
        <Field label="Volumen (m³)" htmlFor="it-v">
          <Input id="it-v" type="number" step="0.001" min={0} value={v.volumeM3} onChange={set("volumeM3")} />
        </Field>
        <Field label="Pieza en el 3D" htmlFor="it-role" hint="Relaciona el artículo con lo que dibuja el visor">
          <NativeSelect id="it-role" value={v.role} onChange={set("role")}>
            {PART_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Revisión cada (días)" htmlFor="it-insp">
          <Input id="it-insp" type="number" min={0} value={v.inspectionIntervalDays ?? ""} onChange={(e) => setV({ ...v, inspectionIntervalDays: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Contenedor" htmlFor="it-cont" className="col-span-2" hint="Una caja de transporte o un conjunto fijo puede llevar dentro otras unidades: al escanearlo se cuenta todo su contenido">
          <NativeSelect
            id="it-cont"
            value={v.container ?? ""}
            onChange={(e) => {
              const container = (e.target.value || null) as ItemFormValues["container"];
              // cases and sets are tracked unit by unit
              setV((x) => ({ ...x, container, kind: container ? "seriado" : x.kind }));
            }}
          >
            <option value="">No, es un artículo normal</option>
            <option value="caja">Caja de transporte (flight case, baúl…)</option>
            <option value="conjunto">Conjunto (p. ej. micro + receptor + baterías)</option>
          </NativeSelect>
        </Field>
        <Field label="Descripción" htmlFor="it-desc" className="col-span-2">
          <Textarea id="it-desc" value={v.description ?? ""} onChange={set("description")} />
        </Field>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Sheet>
  );
}
