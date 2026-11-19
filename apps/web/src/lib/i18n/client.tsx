"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { DICTS, isLocale, LOCALE_COOKIE, type Dict, type Locale } from ".";

const Ctx = createContext<{ locale: Locale; t: Dict; setLocale: (l: Locale) => void }>({ locale: "es", t: DICTS.es, setLocale: () => {} });
const EVENT = "rv-locale";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
function readCookie(): Locale {
  const v = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`))?.[1];
  return isLocale(v) ? v : "es";
}

/** Locale lives in a cookie and is applied on the client so marketing pages stay static. */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readCookie, () => "es" as Locale);
  const setLocale = (l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    window.dispatchEvent(new Event(EVENT));
  };
  return <Ctx.Provider value={{ locale, t: DICTS[locale], setLocale }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
