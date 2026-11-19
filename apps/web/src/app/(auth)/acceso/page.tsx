import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { env } from "@/lib/env";
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
      {env.demoMode && (
        <p className="mb-5 rounded-lg border bg-subtle px-3 py-2 text-xs text-muted-foreground">
          Demo: <strong className="text-foreground">demo@rentevent.es</strong> · <strong className="text-foreground">Rentevent2026!</strong>
        </p>
      )}
      <Suspense>
        <LoginForm social={{ google: Boolean(env.google), microsoft: Boolean(env.microsoft) }} demo={env.demoMode} />
      </Suspense>
    </AuthSplit>
  );
}
