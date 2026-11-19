"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";

export function LoginForm({ social, demo }: { social: { google: boolean; microsoft: boolean }; demo: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app/inicio";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/inicio";
  const [email, setEmail] = useState(demo ? "demo@rentevent.es" : "");
  const [password, setPassword] = useState(demo ? "Rentevent2026!" : "");
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
          : error.message && /bloquead/i.test(error.message)
            ? error.message
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
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> o continúa con <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["google", "Google", social.google],
            ["microsoft", "Microsoft", social.microsoft],
          ] as const
        ).map(([id, label, enabled]) => (
          <Button
            key={id}
            variant="outline"
            disabled={!enabled}
            title={enabled ? undefined : "Configura las credenciales OAuth en las variables de entorno"}
            onClick={() => authClient.signIn.social({ provider: id, callbackURL: safeNext, newUserCallbackURL: "/registro/empresa" })}
          >
            {id === "google" ? <GoogleIcon /> : <MicrosoftIcon />} {label}
          </Button>
        ))}
      </div>
      {!social.google && !social.microsoft && <p className="text-center text-xs text-muted-foreground">Google y Microsoft se activan al configurar sus claves.</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}
function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}
