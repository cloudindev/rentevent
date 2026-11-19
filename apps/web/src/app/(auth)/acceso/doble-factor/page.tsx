"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { AuthSplit } from "@/components/auth-split";

function TwoFactorForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/app/inicio";
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = backup ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: trust }) : await authClient.twoFactor.verifyTotp({ code, trustDevice: trust });
    setLoading(false);
    if (res.error) return setError("Código incorrecto o caducado.");
    router.push(next.startsWith("/") ? next : "/app/inicio");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-2xl font-semibold">Verificación en dos pasos</h1>
      <p className="text-sm text-muted-foreground">{backup ? "Introduce uno de tus códigos de respaldo." : "Introduce el código de 6 dígitos de tu aplicación de autenticación."}</p>
      <Field label={backup ? "Código de respaldo" : "Código"} htmlFor="code">
        <Input id="code" inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.trim())} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={trust} onCheckedChange={(v) => setTrust(v === true)} /> Confiar en este dispositivo 30 días
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" size="lg" disabled={loading || code.length < 6}>
        Verificar
      </Button>
      <button type="button" className="text-sm text-link hover:underline" onClick={() => setBackup((b) => !b)}>
        {backup ? "Usar la aplicación de autenticación" : "Usar un código de respaldo"}
      </button>
    </form>
  );
}

export default function TwoFactorPage() {
  return (
    <AuthSplit>
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthSplit>
  );
}
