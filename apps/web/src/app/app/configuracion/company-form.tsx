"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { saveCompany } from "@/server/actions/settings";

export type CompanyValues = {
  name: string; legalName: string; taxId: string; address: string; city: string; province: string; postalCode: string; phone: string; email: string; website: string; iban: string; brandColor: string;
  availabilityMarginMinutes: number; optionExpiryDays: number; quoteValidityDays: number; quoteTerms: string;
};

export function LogoUploader({ logoUrl, onUploaded }: { logoUrl: string | null; onUploaded?: (url: string) => void }) {
  const router = useRouter();
  const [url, setUrl] = useState(logoUrl);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-subtle">
        {url ? <img src={url} alt="Logotipo de la empresa" className="max-h-14 max-w-14 object-contain" /> : <span className="text-xs text-muted-foreground">Sin logo</span>}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
        <Upload className="size-4" /> {busy ? "Subiendo…" : "Subir logotipo"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            const fd = new FormData();
            fd.append("file", f);
            const res = await fetch("/app/configuracion/logo", { method: "POST", body: fd });
            const j = (await res.json()) as { url?: string; error?: string };
            setBusy(false);
            if (!res.ok || !j.url) {
              toast.error(j.error ?? "No se pudo subir");
              return;
            }
            setUrl(j.url);
            onUploaded?.(j.url);
            toast.success("Logotipo actualizado");
            router.refresh();
          }}
        />
      </label>
      <span className="text-xs text-muted-foreground">PNG, JPG, SVG o WebP · máx. 2 MB</span>
    </div>
  );
}

export function CompanyForm({ initial, logoUrl, base, slug, compact, onSaved }: { initial: CompanyValues; logoUrl: string | null; base: { lat: number; lng: number } | null; slug: string; compact?: boolean; onSaved?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof CompanyValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveCompany(v);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      toast.success(r.data.geocoded ? "Guardado · ubicación de la base actualizada" : "Guardado");
      onSaved?.();
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Datos fiscales</CardTitle>
            <CardDescription>Aparecen en presupuestos, facturas y albaranes. Subdominio: {slug}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><LogoUploader logoUrl={logoUrl} /></div>
          <Field label="Nombre comercial" htmlFor="c-name" error={errors.name}><Input id="c-name" value={v.name} onChange={set("name")} /></Field>
          <Field label="Razón social" htmlFor="c-legal"><Input id="c-legal" value={v.legalName} onChange={set("legalName")} /></Field>
          <Field label="NIF / CIF" htmlFor="c-tax"><Input id="c-tax" value={v.taxId} onChange={set("taxId")} /></Field>
          <Field label="IBAN" htmlFor="c-iban"><Input id="c-iban" value={v.iban} onChange={set("iban")} placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
          <Field label="Dirección de la base" htmlFor="c-addr" className="sm:col-span-2" hint={base ? `Base geolocalizada en ${base.lat.toFixed(4)}, ${base.lng.toFixed(4)} · se usa para calcular kilómetros` : "Se geolocaliza al guardar para calcular el transporte"}>
            <Input id="c-addr" value={v.address} onChange={set("address")} />
          </Field>
          <Field label="Código postal" htmlFor="c-cp"><Input id="c-cp" value={v.postalCode} onChange={set("postalCode")} /></Field>
          <Field label="Población" htmlFor="c-city"><Input id="c-city" value={v.city} onChange={set("city")} /></Field>
          <Field label="Provincia" htmlFor="c-prov"><Input id="c-prov" value={v.province} onChange={set("province")} /></Field>
          <Field label="Teléfono" htmlFor="c-phone"><Input id="c-phone" value={v.phone} onChange={set("phone")} /></Field>
          <Field label="Correo" htmlFor="c-email"><Input id="c-email" type="email" value={v.email} onChange={set("email")} /></Field>
          <Field label="Web" htmlFor="c-web"><Input id="c-web" value={v.website} onChange={set("website")} /></Field>
        </CardContent>
      </Card>
      {!compact && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Funcionamiento</CardTitle>
              <CardDescription>Reglas de reserva y presupuesto.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Color de marca" htmlFor="c-color" error={errors.brandColor} hint="En documentos y en tu página de acceso">
              <div className="flex gap-2">
                <input type="color" aria-label="Selector de color" value={v.brandColor} onChange={(e) => setV({ ...v, brandColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded border" />
                <Input id="c-color" value={v.brandColor} onChange={set("brandColor")} />
              </div>
            </Field>
            <Field label="Margen entre retorno y carga (min)" htmlFor="c-margin" hint="Tiempo de revisión antes de volver a salir"><Input id="c-margin" type="number" min={0} value={v.availabilityMarginMinutes} onChange={set("availabilityMarginMinutes")} /></Field>
            <Field label="Caducidad de las opciones (días)" htmlFor="c-opt"><Input id="c-opt" type="number" min={1} value={v.optionExpiryDays} onChange={set("optionExpiryDays")} /></Field>
            <Field label="Validez del presupuesto (días)" htmlFor="c-valid"><Input id="c-valid" type="number" min={1} value={v.quoteValidityDays} onChange={set("quoteValidityDays")} /></Field>
            <Field label="Condiciones del presupuesto" htmlFor="c-terms" className="sm:col-span-2"><Textarea id="c-terms" rows={5} value={v.quoteTerms} onChange={set("quoteTerms")} /></Field>
          </CardContent>
        </Card>
      )}
      <div className="flex justify-end">
        <Button disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
      </div>
    </form>
  );
}
