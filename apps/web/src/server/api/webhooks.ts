import "server-only";
import { and, eq, webhookDeliveries, webhooks, type Tx } from "@rentevent/db";
import { signWebhook } from "./keys";
import { loadPlanAccess } from "../billing/tenant-access";

export const WEBHOOK_EVENTS = ["order.created", "order.updated", "order.confirmed", "order.cancelled", "quote.sent", "quote.accepted", "invoice.issued", "contact.created"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

async function deliver(url: string, secret: string, event: string, body: string) {
  const ts = Math.floor(Date.now() / 1000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Rentevent-Webhooks/1", "X-Rentevent-Event": event, "X-Rentevent-Signature": signWebhook(secret, ts, body) },
      body,
      signal: AbortSignal.timeout(8000),
    });
    return { status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (e) {
    return { status: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Sends `event` to every active webhook subscribed to it. Each attempt is
 * logged in webhook_deliveries. Failed deliveries are retried through the job
 * queue when one has registered itself on `globalThis.__rentevent_jobs`
 * (enqueue("webhook.retry", { deliveryId })), else
 * once inline.
 */
export async function dispatchWebhook(tx: Tx, event: WebhookEvent | string, payload: unknown) {
  const hooks = (await tx.select().from(webhooks).where(eq(webhooks.active, true))).filter((h) => h.events.includes(event) || h.events.includes("*"));
  // webhooks are part of the plan that includes the API (always on during the free trial)
  if (hooks.length === 0 || !(await loadPlanAccess(tx)).api) return [];
  const results: { webhookId: string; ok: boolean }[] = [];
  for (const h of hooks) results.push({ webhookId: h.id, ok: await deliverToHook(tx, h, event, payload) });
  return results;
}

type Hook = { id: string; url: string; secret: string };

/** Delivers one event to one webhook, logging the attempt and scheduling a retry on failure. */
export async function deliverToHook(tx: Tx, h: Hook, event: string, payload: unknown): Promise<boolean> {
  const body = JSON.stringify({ event, created_at: new Date().toISOString(), data: payload });
  let r = await deliver(h.url, h.secret, event, body);
  let attempts = 1;
  const ok = r.status != null && r.status < 300;
  const [d] = await tx
    .insert(webhookDeliveries)
    .values({ webhookId: h.id, event, payload: (payload ?? {}) as object, status: r.status, attempts, deliveredAt: ok ? new Date() : null, error: r.error })
    .returning({ id: webhookDeliveries.id });
  if (ok) return true;
  const jobs = (globalThis as { __rentevent_jobs?: { enqueue?: (name: string, payload: unknown, opts?: { delayMs?: number }) => Promise<unknown> } }).__rentevent_jobs ?? null;
  if (jobs?.enqueue) {
    try {
      await jobs.enqueue("webhook.retry", { deliveryId: d!.id, webhookId: h.id }, { delayMs: 60_000 });
      return false;
    } catch {
      /* fall through to inline retry */
    }
  }
  r = await deliver(h.url, h.secret, event, body);
  attempts++;
  const ok2 = r.status != null && r.status < 300;
  await tx.update(webhookDeliveries).set({ status: r.status, attempts, error: r.error, deliveredAt: ok2 ? new Date() : null }).where(eq(webhookDeliveries.id, d!.id));
  return ok2;
}

/** Re-sends a logged delivery (used by the job queue and the "Reintentar" button). */
export async function retryDelivery(tx: Tx, deliveryId: string) {
  const [d] = await tx.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId));
  if (!d) return null;
  const [h] = await tx.select().from(webhooks).where(and(eq(webhooks.id, d.webhookId)));
  if (!h) return null;
  const body = JSON.stringify({ event: d.event, created_at: new Date().toISOString(), data: d.payload });
  const r = await deliver(h.url, h.secret, d.event, body);
  await tx.update(webhookDeliveries).set({ status: r.status, attempts: d.attempts + 1, error: r.error, deliveredAt: r.status != null && r.status < 300 ? new Date() : null }).where(eq(webhookDeliveries.id, d.id));
  return r;
}
