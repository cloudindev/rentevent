"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";

/** `accent`: the company's brand colour on /acceso/[slug] (button background and its readable text colour). */
export function LoginForm({ accent }: { accent?: { bg: string; fg: string } | null } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app/inicio";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/inicio";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnverified(false);
    setResend("idle");
    const { data, error } = await authClient.signIn.email({ email, password, rememberMe: remember });
    setLoading(false);
    if (error) {
      const needsVerification = error.status === 403 && /verif/i.test(error.message ?? "");
      setUnverified(needsVerification);
      setError(
        needsVerification
          ? "Confirma tu correo antes de entrar: abre el enlace que te enviamos al registrarte."
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

  async function resendLink() {
    setResend("sending");
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: safeNext });
    setResend(error ? "error" : "sent");
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
          <div role="alert" className="space-y-1 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            <p>{error}</p>
            {unverified &&
              (resend === "sent" ? (
                <p>Te hemos enviado un enlace nuevo a {email}. Revisa también la carpeta de spam.</p>
              ) : (
                <p>
                  ¿No lo encuentras?{" "}
                  <button type="button" className="font-medium underline disabled:opacity-60" disabled={resend === "sending"} onClick={resendLink}>
                    {resend === "sending" ? "Enviando…" : "Reenviar el enlace"}
                  </button>
                  {resend === "error" && " · No se ha podido enviar. Espera un momento y vuelve a probar."}
                </p>
              ))}
          </div>
        )}
        <Button type="submit" className={accent ? "w-full hover:opacity-90" : "w-full"} size="lg" disabled={loading} style={accent ? { backgroundColor: accent.bg, borderColor: accent.bg, color: accent.fg } : undefined}>
          {loading ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </div>
  );
}
