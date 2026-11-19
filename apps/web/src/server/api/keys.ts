import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_PREFIX = "rv_live_";

/** New secret key: shown once, only its SHA-256 is stored. */
export function generateApiKey() {
  const secret = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(secret) };
}

export function hashApiKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function looksLikeApiKey(s: string) {
  return s.startsWith(API_KEY_PREFIX) && s.length >= API_KEY_PREFIX.length + 20 && s.length < 120;
}

export function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Simple in-memory token bucket per key (per server instance). */
const buckets = new Map<string, { tokens: number; at: number }>();
export function takeToken(key: string, capacity = 60, refillPerSec = 1, now = Date.now()): { ok: boolean; remaining: number; retryAfter: number } {
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  const tokens = Math.min(capacity, b.tokens + ((now - b.at) / 1000) * refillPerSec);
  if (tokens < 1) {
    buckets.set(key, { tokens, at: now });
    return { ok: false, remaining: 0, retryAfter: Math.ceil((1 - tokens) / refillPerSec) };
  }
  buckets.set(key, { tokens: tokens - 1, at: now });
  return { ok: true, remaining: Math.floor(tokens - 1), retryAfter: 0 };
}

export function signWebhook(secret: string, timestamp: number, body: string) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
