import { createHmac, timingSafeEqual } from "node:crypto";

/** Calendar feed token = workerId.HMAC(workerId) so the URL is unguessable but stateless. */
export function icsToken(workerId: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(`ics:${workerId}`).digest("base64url").slice(0, 32);
  return `${workerId}.${sig}`;
}

export function verifyIcsToken(token: string, secret: string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const workerId = token.slice(0, i);
  const expected = icsToken(workerId, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? workerId : null;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/** Folds long lines at 75 octets as RFC 5545 requires. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

export type IcsEvent = { uid: string; start: Date; end: Date; summary: string; location?: string | null; description?: string | null };

export function buildIcs(calName: string, events: IcsEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rentevent//Planning//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escape(calName)}`, "X-WR-TIMEZONE:Europe/Madrid"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@rentevent.es`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${escape(e.summary)}`);
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
