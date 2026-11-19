export const LOCALES = ["es", "en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "rv_locale";
export const LOCALE_LABELS: Record<Locale, string> = { es: "Español", en: "English", pt: "Português" };

const es = {
  product: "Producto",
  solutions: "Soluciones",
  pricing: "Precios",
  resources: "Recursos",
  customers: "Clientes",
  login: "Acceder",
  trial: "Prueba gratis",
  demo: "Hablar con un experto",
  promo: "Nuevo: visor 3D de carpas dentro del presupuesto",
  promoCta: "Descúbrelo",
  closeBanner: "Cerrar aviso",
  menu: "Menú",
  footerTagline: "Software para empresas de alquiler y montaje de carpas y estructuras para eventos.",
  rights: "Todos los derechos reservados.",
  language: "Idioma",
};
export type Dict = typeof es;

const en: Dict = {
  product: "Product",
  solutions: "Solutions",
  pricing: "Pricing",
  resources: "Resources",
  customers: "Customers",
  login: "Log in",
  trial: "Free trial",
  demo: "Talk to an expert",
  promo: "New: 3D tent viewer inside every quote",
  promoCta: "Learn more",
  closeBanner: "Close banner",
  menu: "Menu",
  footerTagline: "Software for marquee and event structure rental companies.",
  rights: "All rights reserved.",
  language: "Language",
};

const pt: Dict = {
  product: "Produto",
  solutions: "Soluções",
  pricing: "Preços",
  resources: "Recursos",
  customers: "Clientes",
  login: "Entrar",
  trial: "Teste grátis",
  demo: "Falar com um especialista",
  promo: "Novo: visualizador 3D de tendas no orçamento",
  promoCta: "Saber mais",
  closeBanner: "Fechar aviso",
  menu: "Menu",
  footerTagline: "Software para empresas de aluguer e montagem de tendas e estruturas para eventos.",
  rights: "Todos os direitos reservados.",
  language: "Idioma",
};

export const DICTS: Record<Locale, Dict> = { es, en, pt };

export function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}
