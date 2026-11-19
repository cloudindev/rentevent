"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthSplit } from "@/components/auth-split";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "El enlace no es válido o ha caducado." : null);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <p className="text-sm">
        Contraseña cambiada. <Link className="text-link underline" href="/acceso">Inicia sesión</Link>
      </p>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pw.length < 10) return setError("Mínimo 10 caracteres.");
        if (pw !== pw2) return setError("Las contraseñas no coinciden.");
        const r = await authClient.resetPassword({ newPassword: pw, token: token ?? "" });
        if (r.error) return setError("El enlace no es válido o ha caducado.");
        setDone(true);
      }}
    >
      <Field label="Nueva contraseña" htmlFor="pw">
        <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Repite la contraseña" htmlFor="pw2">
        <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" size="lg" disabled={!token}>
        Guardar contraseña
      </Button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <AuthSplit>
      <h1 className="mb-6 text-2xl font-semibold">Elige una nueva contraseña</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthSplit>
  );
}
