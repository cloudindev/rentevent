import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, generateApiKey, hashApiKey, looksLikeApiKey, safeEqualHex, signWebhook, takeToken } from "./keys";

describe("API keys", () => {
  it("generates a prefixed secret and stores only its hash", () => {
    const k = generateApiKey();
    expect(k.secret.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(k.hash).toBe(hashApiKey(k.secret));
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(k.hash).not.toContain(k.secret);
    expect(k.secret.startsWith(k.prefix)).toBe(true);
    expect(generateApiKey().secret).not.toBe(k.secret);
    expect(looksLikeApiKey(k.secret)).toBe(true);
    expect(looksLikeApiKey("Bearer x")).toBe(false);
    expect(safeEqualHex(k.hash, hashApiKey(k.secret))).toBe(true);
    expect(safeEqualHex(k.hash, hashApiKey("otra"))).toBe(false);
  });
  it("rate limits with a token bucket", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(takeToken("k", 3, 1, t0).ok).toBe(true);
    const r = takeToken("k", 3, 1, t0);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBe(1);
    expect(takeToken("k", 3, 1, t0 + 1500).ok).toBe(true);
  });
  it("signs webhook payloads deterministically", () => {
    const s = signWebhook("sec", 1700000000, '{"a":1}');
    expect(s).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(signWebhook("sec", 1700000000, '{"a":1}')).toBe(s);
    expect(signWebhook("otro", 1700000000, '{"a":1}')).not.toBe(s);
  });
});
