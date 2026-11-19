"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, ChevronDown, Globe, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { MODULES, SOLUTIONS } from "./content";

type MenuKey = "producto" | "soluciones" | "recursos" | null;

const PROMO_KEY = "rv.promo.3d";
const PROMO_EVENT = "rv-promo";
const promoSubscribe = (cb: () => void) => {
  window.addEventListener(PROMO_EVENT, cb);
  return () => window.removeEventListener(PROMO_EVENT, cb);
};
const promoVisible = () => {
  try {
    return localStorage.getItem(PROMO_KEY) !== "1";
  } catch {
    return true;
  }
};

function PromoBanner() {
  const { t } = useI18n();
  const show = useSyncExternalStore(promoSubscribe, promoVisible, () => true);
  if (!show) return null;
  return (
    <div className="relative bg-ink px-10 py-2.5 text-center text-sm text-white">
      <Link href="/producto/visor-3d" className="inline-flex items-center gap-2 hover:underline">
        {t.promo} <span className="hidden font-medium sm:inline">· {t.promoCta}</span> <ArrowRight className="size-4" />
      </Link>
      <button
        onClick={() => {
          try {
            localStorage.setItem(PROMO_KEY, "1");
          } catch {
            /* storage unavailable */
          }
          window.dispatchEvent(new Event(PROMO_EVENT));
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/70 hover:text-white"
        aria-label={t.closeBanner}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="relative inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Globe className="size-4" aria-hidden />
      <span className="sr-only">{t.language}</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])} className="cursor-pointer appearance-none bg-transparent pr-1 font-medium uppercase text-foreground outline-none">
        {LOCALES.map((l) => (
          <option key={l} value={l} aria-label={LOCALE_LABELS[l]}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MarketingHeader() {
  const { t } = useI18n();
  const [open, setOpen] = useState<MenuKey>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const trigger = (key: Exclude<MenuKey, null>, label: string) => (
    <button
      onClick={() => setOpen(open === key ? null : key)}
      onMouseEnter={() => setOpen(key)}
      aria-expanded={open === key}
      aria-haspopup="true"
      className={cn("inline-flex h-9 items-center gap-1 rounded-md px-3 text-[15px] hover:bg-accent", open === key && "bg-accent")}
    >
      {label} <ChevronDown className={cn("size-4 transition-transform", open === key && "rotate-180")} aria-hidden />
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur" ref={ref} onMouseLeave={() => setOpen(null)}>
      <PromoBanner />
      <div className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo height={24} />
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Principal">
            {trigger("producto", t.product)}
            {trigger("soluciones", t.solutions)}
            <Link href="/precios" className="inline-flex h-9 items-center rounded-md px-3 text-[15px] hover:bg-accent" onMouseEnter={() => setOpen(null)}>
              {t.pricing}
            </Link>
            {trigger("recursos", t.resources)}
          </nav>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <LanguageSelect />
            <Link href="/acceso" className="px-2 text-[15px] hover:underline">
              {t.login}
            </Link>
            <Button asChild variant="outline">
              <Link href="/contacto">{t.demo}</Link>
            </Button>
            <Button asChild variant="dark">
              <Link href="/registro">{t.trial}</Link>
            </Button>
          </div>
          <button className="ml-auto rounded-md p-2 hover:bg-accent lg:hidden" onClick={() => setMobile((m) => !m)} aria-expanded={mobile} aria-label={t.menu}>
            {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 hidden border-b bg-background shadow-lg lg:block">
          <div className="mx-auto max-w-7xl px-6 py-6">
            {open === "producto" && (
              <div className="grid grid-cols-4 gap-3">
                {MODULES.map((m) => (
                  <Link key={m.slug} href={`/producto/${m.slug}`} onClick={() => setOpen(null)} className="group rounded-xl border p-4 transition-colors hover:border-border-strong hover:bg-subtle">
                    <m.icon className="size-5 text-brand-600" strokeWidth={1.75} aria-hidden />
                    <p className="mt-3 text-sm font-semibold">{m.name}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{m.short}</p>
                  </Link>
                ))}
              </div>
            )}
            {open === "soluciones" && (
              <div className="grid grid-cols-5 gap-3">
                {SOLUTIONS.map((s) => (
                  <Link key={s.slug} href={`/soluciones/${s.slug}`} onClick={() => setOpen(null)} className="rounded-xl border p-4 hover:bg-subtle">
                    <s.icon className="size-5 text-foreground/70" strokeWidth={1.75} aria-hidden />
                    <p className="mt-3 text-sm font-semibold">{s.name}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{s.short}</p>
                  </Link>
                ))}
              </div>
            )}
            {open === "recursos" && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["/recursos", "Blog y guías", "Ideas para presupuestar, montar y vender más carpas."],
                  ["/clientes", "Clientes", "Cómo trabajan otras empresas con Rentevent."],
                  ["/contacto", "Solicitar una demo", "Te enseñamos el producto con tus propias carpas."],
                ].map(([href, title, text]) => (
                  <Link key={href} href={href!} onClick={() => setOpen(null)} className="rounded-xl border p-4 hover:bg-subtle">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{text}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mobile && (
        <nav className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-b bg-background px-4 pb-6 lg:hidden" aria-label="Principal móvil">
          <p className="pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.product}</p>
          {MODULES.map((m) => (
            <Link key={m.slug} href={`/producto/${m.slug}`} onClick={() => setMobile(false)} className="flex items-center gap-3 rounded-lg py-2.5 text-[15px]">
              <m.icon className="size-4 text-brand-600" aria-hidden /> {m.name}
            </Link>
          ))}
          <p className="pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.solutions}</p>
          {SOLUTIONS.map((s) => (
            <Link key={s.slug} href={`/soluciones/${s.slug}`} onClick={() => setMobile(false)} className="block py-2.5 text-[15px]">
              {s.name}
            </Link>
          ))}
          <div className="mt-2 border-t pt-2">
            {[
              ["/precios", t.pricing],
              ["/recursos", t.resources],
              ["/clientes", t.customers],
              ["/acceso", t.login],
            ].map(([href, l]) => (
              <Link key={href} href={href!} onClick={() => setMobile(false)} className="block py-2.5 text-[15px]">
                {l}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <Button asChild variant="dark" size="lg">
              <Link href="/registro">{t.trial}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contacto">{t.demo}</Link>
            </Button>
            <div className="pt-2">
              <LanguageSelect />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
