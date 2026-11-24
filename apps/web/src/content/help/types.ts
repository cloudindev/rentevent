/**
 * Help centre content model (public, /ayuda). One file per back-office area
 * in ./areas, registered in ./index.ts. Plain data: no JSX, no secrets.
 */

/** One step of a how-to. `text` may use **bold** for UI labels (button, tab, field names). */
export type HelpStep = {
  title: string;
  text: string;
  /** optional hint shown under the step (shortcut, gotcha, good practice) */
  tip?: string;
};

export type HelpArticle = {
  /** kebab-case, unique within the area */
  slug: string;
  title: string;
  /** one sentence: what you achieve with this guide */
  summary: string;
  /** back-office route where this happens, e.g. "/app/pedidos/nuevo" (omit if none) */
  path?: string;
  /** who can do it, e.g. "Administrador, Comercial" (omit if everyone) */
  roles?: string;
  /** optional short paragraph before the steps */
  intro?: string;
  steps: HelpStep[];
  /** optional extra remarks after the steps (rules, limits, what happens next) */
  notes?: string[];
};

export type HelpArea = {
  /** kebab-case, matches the key in ./index.ts */
  slug: string;
  title: string;
  /** one sentence for cards and search results */
  summary: string;
  /** general explanation of the area: 2–5 short paragraphs */
  overview: string[];
  /** key concepts of the area, shown as a glossary */
  concepts?: { term: string; definition: string }[];
  articles: HelpArticle[];
};
