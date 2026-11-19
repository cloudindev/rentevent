import { addDays, dayKey, parseDayKey } from "@rentevent/core";
import type { Range } from "@/server/analytics";

const re = /^\d{4}-\d{2}-\d{2}$/;

/** Default: from the first day 11 months ago to the end of the month after next. */
export function resolveRange(sp: { desde?: string; hasta?: string }): Range {
  const today = dayKey(Date.now());
  const [y, m] = parseDayKey(today);
  const back = new Date(Date.UTC(y, m - 1 - 11, 1)).toISOString().slice(0, 10);
  const fwd = addDays(new Date(Date.UTC(y, m + 2, 1)).toISOString().slice(0, 10), -1);
  const from = sp.desde && re.test(sp.desde) ? sp.desde : back;
  const to = sp.hasta && re.test(sp.hasta) ? sp.hasta : fwd;
  return from <= to ? { from, to } : { from: to, to: from };
}
