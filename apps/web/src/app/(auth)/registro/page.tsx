import type { Metadata } from "next";
import Link from "next/link";
import { AuthSplit } from "@/components/auth-split";
import { env } from "@/lib/env";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Prueba gratis 14 días" };

export default function RegisterPage() {
  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Crea tu cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        ¿Ya usas Rentevent?{" "}
        <Link href="/acceso" className="text-link hover:underline">
          Inicia sesión
        </Link>
      </p>
      <RegisterForm rootDomain={env.rootDomain.split(":")[0]!} devOutbox={!env.smtpUrl} />
    </AuthSplit>
  );
}
