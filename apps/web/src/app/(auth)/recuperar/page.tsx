"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthSplit } from "@/components/auth-split";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      {sent ? (
        <p className="mt-3 text-sm text-muted-foreground">Si existe una cuenta con {email}, recibirás un enlace para elegir una nueva contraseña. Caduca en una hora.</p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            await authClient.requestPasswordReset({ email, redirectTo: "/restablecer" });
            setLoading(false);
            setSent(true);
          }}
        >
          <Field label="Correo electrónico" htmlFor="email">
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button className="w-full" size="lg" disabled={loading || !email}>
            Enviar enlace
          </Button>
        </form>
      )}
      <Link href="/acceso" className="mt-6 inline-block text-sm text-link hover:underline">
        Volver al acceso
      </Link>
    </AuthSplit>
  );
}
