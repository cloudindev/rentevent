"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { acceptInvitation, signUpInvited } from "@/server/actions/auth";

export function InvitationActions({ id, email, signedInAs }: { id: string; email: string; signedInAs: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);

  if (signedInAs)
    return (
      <div className="space-y-3">
        <p className="text-sm">Has iniciado sesión como {signedInAs}.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button
          className="w-full"
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await acceptInvitation(id);
              if (!r.ok) return setError(r.error ?? "No se pudo aceptar");
              router.push("/app/inicio");
              router.refresh();
            })
          }
        >
          Aceptar invitación
        </Button>
      </div>
    );

  if (sent) return <p className="text-sm text-muted-foreground">Te hemos enviado un correo a {email} para confirmar la cuenta. Al confirmarlo volverás aquí para aceptar la invitación.</p>;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await signUpInvited({ invitationId: id, name, password });
          if (!r.ok) return setError(r.error ?? Object.values(r.fieldErrors ?? {})[0] ?? "Error");
          setSent(true);
        });
      }}
    >
      <Field label="Correo" htmlFor="email">
        <Input id="email" value={email} disabled />
      </Field>
      <Field label="Tu nombre" htmlFor="name">
        <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Contraseña" htmlFor="pw" hint="Mínimo 10 caracteres">
        <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button className="w-full" size="lg" disabled={pending}>
        Crear cuenta y unirme
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta? <Link className="text-link hover:underline" href={`/acceso?next=/invitacion/${id}`}>Inicia sesión</Link>
      </p>
    </form>
  );
}
