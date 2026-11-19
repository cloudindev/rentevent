import Link from "next/link";
import { Logo } from "@/components/brand";

export function AuthSplit({ children, aside, logo }: { children: React.ReactNode; aside?: React.ReactNode; logo?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div>{logo ?? <Logo />}</div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Rentevent · <Link className="hover:underline" href="/legal/privacidad">Privacidad</Link> · <Link className="hover:underline" href="/legal/terminos">Términos</Link></p>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">{aside ?? <DefaultAside />}</div>
    </div>
  );
}

function DefaultAside() {
  return (
    <div className="flex h-full flex-col justify-between p-12 text-white">
      <div />
      <div>
        <p className="max-w-md text-3xl font-semibold leading-tight">De la consulta al montaje, sin hojas de cálculo.</p>
        <p className="mt-4 max-w-md text-white/70">Despiece automático de cada carpa, stock de cerchas en tiempo real y la carpa en 3D dentro del presupuesto.</p>
        <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-sm">
          {[
            ["49", "cerchas de 10 m bajo control"],
            ["< 2 min", "para presupuestar una 15x30"],
            ["0", "dobles reservas"],
          ].map(([a, b]) => (
            <div key={b} className="rounded-xl border border-white/15 p-3">
              <p className="text-xl font-semibold text-brand-400">{a}</p>
              <p className="mt-1 text-white/60">{b}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-white/50">rentevent.es</p>
    </div>
  );
}
