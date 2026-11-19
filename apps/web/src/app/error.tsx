"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-7xl font-bold tracking-tight text-foreground/20">500</p>
      <h1 className="mt-4 text-2xl font-semibold">Algo ha fallado</h1>
      <p className="mt-2 max-w-md text-muted-foreground">Hemos registrado el error. Vuelve a intentarlo en unos segundos.{error.digest ? ` Referencia: ${error.digest}` : ""}</p>
      <div className="mt-8 flex gap-3">
        <Button variant="dark" onClick={reset}>
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
