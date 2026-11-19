"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { saveContact } from "@/server/actions/contacts";

export type ContactForm = { id: string | null; kind: "cliente" | "proveedor" | "localizacion"; name: string; legalName: string | null; taxId: string | null; email: string | null; phone: string | null; website: string | null; discountPct: number; paymentTermsDays: number; tags: string[]; notes: string | null; address?: string | null; city?: string | null };
const EMPTY: ContactForm = { id: null, kind: "cliente", name: "", legalName: null, taxId: null, email: null, phone: null, website: null, discountPct: 0, paymentTermsDays: 30, tags: [], notes: null, address: "", city: "" };

export function ContactSheet({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: ContactForm }) {
  const router = useRouter();
  const [v, setV] = useState<ContactForm>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof ContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value || null });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={v.id ? "Editar contacto" : "Nuevo contacto"}>
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveContact({ ...v, name: v.name ?? "" });
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
              return;
            }
            onOpenChange(false);
            toast.success("Contacto guardado");
            if (!v.id) router.push(`/app/contactos/${r.data.id}`);
            else router.refresh();
          });
        }}
      >
        <Field label="Tipo" htmlFor="c-kind">
          <NativeSelect id="c-kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as ContactForm["kind"] })}>
            <option value="cliente">Cliente</option>
            <option value="proveedor">Proveedor</option>
            <option value="localizacion">Localización</option>
          </NativeSelect>
        </Field>
        <Field label="NIF / CIF" htmlFor="c-tax">
          <Input id="c-tax" value={v.taxId ?? ""} onChange={set("taxId")} />
        </Field>
        <Field label="Nombre" htmlFor="c-name" error={errors.name} className="col-span-2">
          <Input id="c-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <Field label="Razón social" htmlFor="c-legal" className="col-span-2">
          <Input id="c-legal" value={v.legalName ?? ""} onChange={set("legalName")} />
        </Field>
        <Field label="Correo" htmlFor="c-email" error={errors.email}>
          <Input id="c-email" type="email" value={v.email ?? ""} onChange={set("email")} />
        </Field>
        <Field label="Teléfono" htmlFor="c-phone">
          <Input id="c-phone" value={v.phone ?? ""} onChange={set("phone")} />
        </Field>
        {!v.id && (
          <>
            <Field label="Dirección" htmlFor="c-addr" className="col-span-2" hint="Se geocodifica para calcular el transporte">
              <Input id="c-addr" value={v.address ?? ""} onChange={set("address")} />
            </Field>
            <Field label="Población" htmlFor="c-city">
              <Input id="c-city" value={v.city ?? ""} onChange={set("city")} />
            </Field>
          </>
        )}
        <Field label="Descuento %" htmlFor="c-disc">
          <Input id="c-disc" type="number" min={0} max={100} value={v.discountPct} onChange={set("discountPct")} />
        </Field>
        <Field label="Plazo de pago (días)" htmlFor="c-terms">
          <Input id="c-terms" type="number" min={0} value={v.paymentTermsDays} onChange={set("paymentTermsDays")} />
        </Field>
        <Field label="Web" htmlFor="c-web">
          <Input id="c-web" value={v.website ?? ""} onChange={set("website")} />
        </Field>
        <Field label="Etiquetas" htmlFor="c-tags" className="col-span-2" hint="Separadas por comas">
          <Input id="c-tags" value={v.tags.join(", ")} onChange={(e) => setV({ ...v, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
        </Field>
        <Field label="Notas" htmlFor="c-notes" className="col-span-2">
          <Textarea id="c-notes" value={v.notes ?? ""} onChange={set("notes")} />
        </Field>
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Sheet>
  );
}
