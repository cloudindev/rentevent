import Link from "next/link";
import { Logo } from "@/components/brand";
import { MODULES, SOLUTIONS } from "./content";
import { InstagramIcon, LinkedInIcon, XIcon, YouTubeIcon } from "./social";
import { CookieSettingsLink } from "./cookie-consent";

const COLS: { title: string; links: [string, string][] }[] = [
  { title: "Producto", links: MODULES.slice(0, 6).map((m) => [`/producto/${m.slug}`, m.name]) },
  { title: "Soluciones", links: SOLUTIONS.map((s) => [`/soluciones/${s.slug}`, s.name]) },
  {
    title: "Empresa",
    links: [
      ["/precios", "Precios"],
      ["/clientes", "Clientes"],
      ["/recursos", "Blog"],
      ["/contacto", "Contacto"],
      ["/acceso", "Acceder"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["/legal/aviso-legal", "Aviso legal"],
      ["/legal/privacidad", "Privacidad"],
      ["/legal/cookies", "Cookies"],
      ["/legal/terminos", "Términos"],
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t bg-subtle">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Logo height={22} />
            <p className="mt-4 text-sm text-muted-foreground">Software para empresas de alquiler y montaje de carpas y estructuras para eventos. Hecho en Asturias.</p>
            <div className="mt-5 flex gap-3 text-foreground/70">
              {[
                ["LinkedIn", LinkedInIcon],
                ["Instagram", InstagramIcon],
                ["YouTube", YouTubeIcon],
                ["X", XIcon],
              ].map(([label, Icon]) => {
                const I = Icon as typeof LinkedInIcon;
                return (
                  <a key={label as string} href="#" aria-label={`Rentevent en ${label as string}`} className="rounded-md p-1.5 hover:bg-accent hover:text-foreground">
                    <I className="size-4" />
                  </a>
                );
              })}
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h2 className="text-sm font-semibold">{c.title}</h2>
              <ul className="mt-3 space-y-2">
                {c.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Rentevent. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <CookieSettingsLink />
            <span>Datos alojados en la Unión Europea</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
