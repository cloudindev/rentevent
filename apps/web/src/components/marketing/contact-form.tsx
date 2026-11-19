"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { requestDemo } from "@/app/(marketing)/contacto/actions";

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", company: "", phone: "", size: "1-5" as "1-5" | "6-20" | "21-50" | "50+", message: "", privacy: false, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (sent)
    return (
      <div className="flex h-full flex-col items-center justify-center py-10 text-center" role="status">
        <CircleCheck className="size-10 text-success" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold">¡Gracias, {f.name.split(" ")[0]}!</h2>
        <p className="mt-2 max-w-sm text-muted-foreground">Te escribiremos a {f.email} en menos de un día laborable para fijar la demo.</p>
      </div>
    );

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestDemo({ ...f, privacy: f.privacy as true });
          setErrors(r.fieldErrors ?? {});
          setError(r.ok ? null : r.error ?? null);
          if (r.ok) setSent(true);
        });
      }}
    >
      <h2 className="text-xl font-semibold">Solicita una demo</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="c-name" error={errors.name}>
          <Input id="c-name" autoComplete="name" value={f.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Correo de trabajo" htmlFor="c-email" error={errors.email}>
          <Input id="c-email" type="email" autoComplete="email" value={f.email} onChange={set("email")} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Empresa" htmlFor="c-company" error={errors.company}>
          <Input id="c-company" autoComplete="organization" value={f.company} onChange={set("company")} aria-invalid={Boolean(errors.company)} />
        </Field>
        <Field label="Teléfono (opcional)" htmlFor="c-phone">
          <Input id="c-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} />
        </Field>
      </div>
      <Field label="Personas en la empresa" htmlFor="c-size">
        <NativeSelect id="c-size" value={f.size} onChange={set("size")}>
          <option value="1-5">1 a 5</option>
          <option value="6-20">6 a 20</option>
          <option value="21-50">21 a 50</option>
          <option value="50+">Más de 50</option>
        </NativeSelect>
      </Field>
      <Field label="¿Qué te gustaría ver? (opcional)" htmlFor="c-msg">
        <Textarea id="c-msg" rows={4} value={f.message} onChange={set("message")} />
      </Field>
      <div className="hidden" aria-hidden>
        <label htmlFor="c-web">Web</label>
        <input id="c-web" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={f.privacy} onCheckedChange={(v) => setF((x) => ({ ...x, privacy: v === true }))} aria-invalid={Boolean(errors.privacy)} />
        <span>
          He leído la <Link href="/legal/privacidad" className="text-link underline">política de privacidad</Link> y acepto que me contactéis sobre esta solicitud.
        </span>
      </label>
      {errors.privacy && <p className="text-xs text-danger">{errors.privacy}</p>}
      {error && !Object.keys(errors).length && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button size="lg" variant="dark" disabled={pending}>
        {pending ? "Enviando…" : "Solicitar demo"}
      </Button>
    </form>
  );
}
