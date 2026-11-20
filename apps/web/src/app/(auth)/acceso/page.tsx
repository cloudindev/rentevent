import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSplit } from "@/components/auth-split";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Bienvenido de nuevo</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="text-link hover:underline">
          Prueba gratis 14 días
        </Link>
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthSplit>
  );
}
