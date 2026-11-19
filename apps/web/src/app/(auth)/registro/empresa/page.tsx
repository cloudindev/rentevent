"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthSplit } from "@/components/auth-split";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createCompanyForCurrentUser } from "@/server/actions/auth";

export default function CreateCompanyPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [slug, setSlug] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Crea tu empresa</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Tu espacio de trabajo con su propio subdominio. Empiezas con 14 días de prueba.</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createCompanyForCurrentUser({ company, slug });
            setErrors(r.fieldErrors ?? {});
            setError(r.ok ? null : r.error ?? null);
            if (r.ok) router.push("/app/onboarding");
          });
        }}
      >
        <Field label="Empresa" htmlFor="company" error={errors.company}>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field label="Subdominio" htmlFor="slug" error={errors.slug} hint="Opcional: si lo dejas vacío lo generamos del nombre">
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button className="w-full" size="lg" disabled={pending}>
          Crear empresa
        </Button>
      </form>
    </AuthSplit>
  );
}
