"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { checkSlug, registerCompany } from "@/server/actions/auth";

export function RegisterForm({ rootDomain, devOutbox }: { rootDomain: string; devOutbox: boolean }) {
  const [form, setForm] = useState({ company: "", slug: "", name: "", email: "", password: "", terms: false });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<{ slug: string; available: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!slugTouched) setForm((f) => ({ ...f, slug: f.company }));
  }, [form.company, slugTouched]);
  useEffect(() => {
    if (form.slug.trim().length < 3) return setSlugState(null);
    const t = setTimeout(async () => setSlugState(await checkSlug(form.slug)), 250);
    return () => clearTimeout(t);
  }, [form.slug]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (done)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">
          Hemos enviado un enlace de confirmación a <strong className="text-foreground">{done}</strong>. Al confirmarlo entrarás directamente al asistente de configuración.
        </p>
        {devOutbox && (
          <p className="rounded-lg border bg-subtle p-3 text-sm">
            Modo local sin servidor de correo: abre el <Link className="text-link underline" href="/dev/correo">buzón de pruebas</Link> para ver el enlace.
          </p>
        )}
      </div>
    );

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await registerCompany({ ...form, slug: slugState?.slug ?? form.slug, terms: form.terms as true });
          setErrors(res.fieldErrors ?? {});
          setError(res.ok ? null : res.error ?? null);
          if (res.ok) setDone(res.data!.email!);
        });
      }}
    >
      <Field label="Empresa" htmlFor="company" error={errors.company}>
        <Input id="company" autoComplete="organization" value={form.company} onChange={set("company")} aria-invalid={Boolean(errors.company)} />
      </Field>
      <Field label="Subdominio" htmlFor="slug" error={errors.slug} hint={slugState ? `${slugState.slug}.${rootDomain}` : undefined}>
        <div className="relative">
          <Input
            id="slug"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug")(e);
            }}
            aria-invalid={Boolean(errors.slug) || slugState?.available === false}
            className="pr-9"
          />
          {slugState && <span className="absolute right-3 top-2.5">{slugState.available ? <Check className="size-4 text-success" aria-label="Disponible" /> : <X className="size-4 text-danger" aria-label="No disponible" />}</span>}
        </div>
      </Field>
      <Field label="Tu nombre" htmlFor="name" error={errors.name}>
        <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} />
      </Field>
      <Field label="Correo de trabajo" htmlFor="email" error={errors.email}>
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={errors.password} hint="Mínimo 10 caracteres">
        <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5" checked={form.terms} onCheckedChange={(v) => setForm((f) => ({ ...f, terms: v === true }))} aria-invalid={Boolean(errors.terms)} />
        <span>
          Acepto los <Link className="text-link underline" href="/legal/terminos">términos</Link> y la <Link className="text-link underline" href="/legal/privacidad">política de privacidad</Link>.
        </span>
      </label>
      {errors.terms && <p className="text-xs text-danger">{errors.terms}</p>}
      {error && !Object.keys(errors).length && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "Creando tu espacio…" : "Empezar prueba gratuita"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">14 días gratis · sin tarjeta</p>
    </form>
  );
}
