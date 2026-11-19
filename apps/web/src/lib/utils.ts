import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" });
const num = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" });

export const formatEUR = (n: number | null | undefined) => eur.format(Number(n ?? 0));
export const formatNumber = (n: number | null | undefined) => num.format(Number(n ?? 0));

const TZ = "Europe/Madrid";
export function formatDate(d: Date | string | number | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (d == null) return "—";
  return new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...opts }).format(new Date(d));
}
export const formatDateTime = (d: Date | string | number | null | undefined) =>
  formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const formatTime = (d: Date | string | number | null | undefined) => formatDate(d, { hour: "2-digit", minute: "2-digit" });

export function formatRange(a: Date | string | null | undefined, b: Date | string | null | undefined) {
  if (!a || !b) return "Sin fechas";
  const f = (d: Date | string) => formatDate(d, { weekday: "short", day: "numeric", month: "short" });
  return `${f(a)} – ${f(b)}`;
}

/** datetime-local input value in Europe/Madrid */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  return parts.replace(" ", "T");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
