import { CookieConsent } from "@/components/marketing/cookie-consent";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { LocaleProvider } from "@/lib/i18n/client";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <a href="#contenido" className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Saltar al contenido
      </a>
      <MarketingHeader />
      <main id="contenido">{children}</main>
      <MarketingFooter />
      <CookieConsent />
    </LocaleProvider>
  );
}
