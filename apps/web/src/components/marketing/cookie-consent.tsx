"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/menu";

export const CONSENT_COOKIE = "rv_consent";
type Consent = { necessary: true; analytics: boolean; marketing: boolean; at: string };

function read(): Consent | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1]!)) as Consent;
  } catch {
    return null;
  }
}
function write(c: Omit<Consent, "at" | "necessary">) {
  const v: Consent = { necessary: true, ...c, at: new Date().toISOString() };
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(v))}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
  window.dispatchEvent(new CustomEvent("rv-consent", { detail: v }));
}

const OPEN_EVENT = "rv-consent-open";

export function CookieSettingsLink() {
  return (
    <button className="hover:text-foreground hover:underline" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Configurar cookies
    </button>
  );
}

const subscribeConsent = (cb: () => void) => {
  window.addEventListener("rv-consent", cb);
  return () => window.removeEventListener("rv-consent", cb);
};
const hasConsent = () => read() !== null;

export function CookieConsent() {
  const decided = useSyncExternalStore(subscribeConsent, hasConsent, () => true);
  const [forced, setForced] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const open = () => {
      const c = read();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setForced(true);
      setConfigure(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (decided && !forced) return null;
  const done = (a: boolean, m: boolean) => {
    write({ analytics: a, marketing: m });
    setForced(false);
    setConfigure(false);
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookie-title" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border bg-popover p-5 shadow-2xl sm:left-auto sm:right-5 sm:bottom-5 sm:mx-0">
      <h2 id="cookie-title" className="text-sm font-semibold">
        Usamos cookies
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Las necesarias hacen que la web funcione. Con tu permiso usaremos también cookies de analítica para mejorarla. Más información en la{" "}
        <Link href="/legal/cookies" className="text-link underline">
          política de cookies
        </Link>
        .
      </p>
      {configure && (
        <div className="mt-4 space-y-3 rounded-xl border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              <strong className="font-medium">Necesarias</strong>
              <span className="block text-xs text-muted-foreground">Sesión, seguridad y preferencias.</span>
            </span>
            <Switch checked disabled aria-label="Cookies necesarias (siempre activas)" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>
              <strong className="font-medium">Analítica</strong>
              <span className="block text-xs text-muted-foreground">Medición anónima de uso.</span>
            </span>
            <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Cookies de analítica" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>
              <strong className="font-medium">Marketing</strong>
              <span className="block text-xs text-muted-foreground">Campañas y remarketing.</span>
            </span>
            <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Cookies de marketing" />
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {configure ? (
          <Button size="sm" variant="dark" onClick={() => done(analytics, marketing)}>
            Guardar preferencias
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfigure(true)}>
            Configurar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => done(false, false)}>
          Rechazar
        </Button>
        <Button size="sm" variant="dark" onClick={() => done(true, true)}>
          Aceptar todas
        </Button>
      </div>
    </div>
  );
}
