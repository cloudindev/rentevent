"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app/inicio";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/inicio";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({ email, password, rememberMe: remember });
    setLoading(false);
    if (error) {
      setError(
        error.status === 403 && /verif/i.test(error.message ?? "")
          ? "Confirma tu correo antes de entrar. Te hemos reenviado el enlace."
          : error.status === 429
            ? "Demasiados intentos seguidos. Espera unos segundos y vuelve a probar."
            : "Correo o contraseña incorrectos.",
      );
      return;
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    router.push(safeNext);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} aria-label="Recordar sesión" /> Recordar sesión
          </label>
          <Link href="/recuperar" className="text-link hover:underline">
            ¿Has olvidado la contraseña?
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </div>
  );
}
