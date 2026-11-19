import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-12 text-7xl font-bold tracking-tight text-brand-500">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Esta página no está en el despiece</h1>
      <p className="mt-2 max-w-md text-muted-foreground">Puede que el enlace haya cambiado o que la página ya no exista.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild variant="dark">
          <Link href="/">Ir al inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/inicio">Abrir la aplicación</Link>
        </Button>
      </div>
    </main>
  );
}
