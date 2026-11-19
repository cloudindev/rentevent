/**
 * Spanish date and intent parsing for the simulated assistant. Pure: no DB,
 * no server-only imports, so it is unit-tested directly.
 */
import { addDays, dayKey, parseDayKey } from "@rentevent/core";

export const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
const WEEKDAYS: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
const MONTH_RE = Object.keys(MONTHS).join("|");

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type DateRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const validDay = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Year for a day/month without year: this year, or next year if it is clearly past. */
function inferYear(m: number, d: number, today: string): number {
  const [ty] = parseDayKey(today);
  const candidate = key(ty, m, d);
  return candidate < addDays(today, -60) ? ty + 1 : ty;
}

function weekdayOf(k: string) {
  const [y, m, d] = parseDayKey(k);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Next occurrence of a weekday (today counts). */
function nextWeekday(today: string, dow: number) {
  const diff = (dow - weekdayOf(today) + 7) % 7;
  return addDays(today, diff);
}

function mondayOf(k: string) {
  return addDays(k, -((weekdayOf(k) + 6) % 7));
}

/**
 * Extracts a date range from Spanish text. Single dates return from = to.
 * Supports: "12 de diciembre", "del 12 al 15 de diciembre", "entre el 12 y el 15
 * de diciembre", "12-15 de diciembre", "del 28 de diciembre al 3 de enero",
 * "12/12", "12/12/2026", "hoy", "mañana", "pasado mañana", "el sábado",
 * "esta semana", "la semana que viene", "este mes", "el mes que viene",
 * "en diciembre".
 */
export function parseDateRange(text: string, now: number = Date.now()): DateRange | null {
  const t = normalize(text);
  const today = dayKey(now);

  const full = new RegExp(`(?:del?|entre(?: el)?)\\s+(\\d{1,2})(?:\\s+de\\s+(${MONTH_RE}))?(?:\\s+de\\s+(\\d{4}))?\\s+(?:al?|y(?: el)?|hasta(?: el)?)\\s+(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+(\\d{4}))?`);
  let m = t.match(full);
  if (m) {
    const d1 = Number(m[1]);
    const d2 = Number(m[4]);
    const m2 = MONTHS[m[5]!]!;
    const m1 = m[2] ? MONTHS[m[2]]! : m2;
    const y2 = m[6] ? Number(m[6]) : inferYear(m2, d2, today);
    const y1 = m[3] ? Number(m[3]) : m1 > m2 ? y2 - 1 : y2;
    if (validDay(y1, m1, d1) && validDay(y2, m2, d2)) {
      const a = key(y1, m1, d1);
      const b = key(y2, m2, d2);
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
  }
  m = t.match(new RegExp(`(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+de\\s+(\\d{4}))?`));
  if (m) {
    const mo = MONTHS[m[3]!]!;
    const y = m[4] ? Number(m[4]) : inferYear(mo, Number(m[2]), today);
    if (validDay(y, mo, Number(m[1])) && validDay(y, mo, Number(m[2]))) return { from: key(y, mo, Number(m[1])), to: key(y, mo, Number(m[2])) };
  }
  m = t.match(new RegExp(`(\\d{1,2})\\s+de\\s+(${MONTH_RE})(?:\\s+(?:de|del)\\s+(\\d{4}))?`));
  if (m) {
    const mo = MONTHS[m[2]!]!;
    const d = Number(m[1]);
    const y = m[3] ? Number(m[3]) : inferYear(mo, d, today);
    return validDay(y, mo, d) ? { from: key(y, mo, d), to: key(y, mo, d) } : null;
  }
  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = m[3] ? Number(m[3]) : inferYear(mo, d, today);
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && validDay(y, mo, d)) return { from: key(y, mo, d), to: key(y, mo, d) };
  }
  if (/\bpasado manana\b/.test(t)) return { from: addDays(today, 2), to: addDays(today, 2) };
  if (/\bmanana\b/.test(t)) return { from: addDays(today, 1), to: addDays(today, 1) };
  if (/\bhoy\b/.test(t)) return { from: today, to: today };
  if (/\b(semana que viene|proxima semana|siguiente semana)\b/.test(t)) {
    const mon = addDays(mondayOf(today), 7);
    return { from: mon, to: addDays(mon, 6) };
  }
  if (/\b(esta semana|la semana)\b/.test(t)) {
    const mon = mondayOf(today);
    return { from: mon, to: addDays(mon, 6) };
  }
  const wd = t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (wd) {
    const d = nextWeekday(today, WEEKDAYS[wd[1]!]!);
    return { from: d, to: d };
  }
  const [ty, tm] = parseDayKey(today);
  const monthBounds = (y: number, mo: number) => {
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return { from: key(y, mo, 1), to: key(y, mo, last) };
  };
  if (/\b(mes que viene|proximo mes|siguiente mes)\b/.test(t)) return tm === 12 ? monthBounds(ty + 1, 1) : monthBounds(ty, tm + 1);
  if (/\b(este mes|el mes)\b/.test(t)) return monthBounds(ty, tm);
  m = t.match(new RegExp(`\\b(${MONTH_RE})\\b(?:\\s+(?:de|del)\\s+(\\d{4}))?`));
  if (m) {
    const mo = MONTHS[m[1]!]!;
    const y = m[2] ? Number(m[2]) : mo < tm - 2 ? ty + 1 : ty;
    return monthBounds(y, mo);
  }
  return null;
}

export type Intent =
  | { kind: "crear_borrador"; width: number | null; length: number | null; height: "alta" | "baja" | null; client: string | null; range: DateRange | null }
  | { kind: "largo_maximo"; range: DateRange | null; anchoring: "anclaje" | "pesos" }
  | { kind: "personal_libre"; range: DateRange | null }
  | { kind: "disponibilidad"; item: string; range: DateRange | null }
  | { kind: "pedidos_periodo"; range: DateRange | null }
  | { kind: "resumen_facturacion"; range: DateRange | null }
  | { kind: "ayuda" };

/** Removes date phrases so the rest of the text can be read as names. */
function stripDates(t: string) {
  return t
    .replace(new RegExp(`(?:del?|entre(?: el)?)\\s+\\d{1,2}(?:\\s+de\\s+(?:${MONTH_RE}))?\\s+(?:al?|y(?: el)?)\\s+\\d{1,2}\\s+de\\s+(?:${MONTH_RE})(?:\\s+de\\s+\\d{4})?`, "g"), " ")
    .replace(new RegExp(`(?:el\\s+)?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)?\\s*\\d{1,2}\\s+de\\s+(?:${MONTH_RE})(?:\\s+de\\s+\\d{4})?`, "g"), " ")
    .replace(/\b(hoy|manana|pasado manana|esta semana|este mes)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectIntent(text: string, now: number = Date.now()): Intent {
  const t = normalize(text);
  const range = parseDateRange(text, now);

  if (/\b(crea|crear|creame|haz|hazme|prepara|preparame|abre|nuevo|genera)\b.*\b(pedido|borrador|presupuesto)\b/.test(t)) {
    const size = t.match(/\b(\d{1,2})\s*(?:x|×|por)\s*(\d{1,3})\b/);
    const height = /\bpata alta|\balta\b/.test(t) ? "alta" : /\bpata baja|\bbaja\b/.test(t) ? "baja" : null;
    // the client is the "para …" segment that is not a date
    const segments = stripDates(t)
      .split(/\bpara\b/)
      .slice(1)
      .map((s) => s.replace(/^\s*(el|la|los|las)\s+(cliente\s+)?/, "").replace(/^\s*cliente\s+/, "").replace(/[,.;].*$/, "").trim())
      .filter((s) => s.length > 1 && !/^\d/.test(s) && !/^(el|la)$/.test(s));
    return { kind: "crear_borrador", width: size ? Number(size[1]) : null, length: size ? Number(size[2]) : null, height, client: segments[segments.length - 1] ?? null, range };
  }
  if (/\b(quien|quienes)\b.*\b(libre|libres|disponible|disponibles)\b|\b(personal|montadores|trabajadores|gente|equipo)\b.*\b(libre|libres|disponible|disponibles)\b/.test(t)) {
    return { kind: "personal_libre", range };
  }
  if (/\b(que|cual|cuales)\s+carpas?\b|\bpuedo montar\b|\blargo maximo\b|\b(que|cuanto)\s+(tamano|medida|largo)\b|\bcuantos metros\b|\bcarpa mas grande\b/.test(t)) {
    return { kind: "largo_maximo", range, anchoring: /\bpesos|lastre|sin anclar|contrapes/.test(t) ? "pesos" : "anclaje" };
  }
  if (/\bfactur|ingres|\bcobr|\bventas\b|\bhemos ganado\b/.test(t)) return { kind: "resumen_facturacion", range };
  const avail = t.match(/\b(?:disponibilidad|stock)\s+(?:de|del)\s+(.+)|\b(?:cuant[oa]s?|hay)\s+(.+?)\s+(?:libres|disponibles|quedan|tenemos)\b|\b(?:quedan|hay)\s+(.+?)\s+(?:libres|disponibles)\b/);
  if (avail) {
    const raw = stripDates(avail[1] ?? avail[2] ?? avail[3] ?? "")
      .replace(/\b(el|la|los|las|del|de|en|para|entre|y|al)\s*$/g, "")
      .replace(/\b(hay|tenemos|libres|disponibles|quedan)\b/g, "")
      .trim();
    if (raw) return { kind: "disponibilidad", item: raw, range };
  }
  if (/\b(pedidos|montajes|eventos|desmontajes|trabajos)\b/.test(t)) return { kind: "pedidos_periodo", range };
  return { kind: "ayuda" };
}

/** Best fuzzy match of a free-text name against a list (token overlap + includes). */
export function bestMatch<T>(query: string, list: T[], label: (x: T) => string): T | null {
  const q = normalize(query)
    .split(" ")
    .filter((w) => w.length > 1 && !["de", "del", "la", "el", "los", "las", "m", "metros"].includes(w))
    .map((w) => (/\d/.test(w) ? w : w.replace(/(es|s)$/, "")));
  if (q.length === 0) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const x of list) {
    const l = normalize(label(x));
    let score = 0;
    for (const w of q) if (l.includes(w)) score += /\d/.test(w) ? 2 : 1;
    if (l === normalize(query)) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return bestScore >= Math.max(1, Math.ceil(q.length / 2)) ? best : null;
}
