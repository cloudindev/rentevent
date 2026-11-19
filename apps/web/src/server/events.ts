import "server-only";
import { after } from "next/server";
import { withTenant } from "@rentevent/db";
import { dispatchWebhook, type WebhookEvent } from "./api/webhooks";
import { runWorkflowsFor } from "./workflows";

const WORKFLOW_TRIGGER: Partial<Record<WebhookEvent, string>> = { "order.created": "pedido_creado", "order.confirmed": "pedido_confirmado" };

type Hook = (tenantId: string, event: string, payload: Record<string, unknown>) => Promise<void>;
const extraHooks: Hook[] = [];

/** Lets other modules (workflows) subscribe to domain events. */
export function onDomainEvent(h: Hook) {
  extraHooks.push(h);
}

/**
 * Emits a domain event after the response is sent: outgoing webhooks and
 * any registered listeners run outside the request transaction.
 */
export function emitEvent(tenantId: string, event: WebhookEvent, payload: Record<string, unknown>) {
  const run = async () => {
    try {
      await withTenant(tenantId, (tx) => dispatchWebhook(tx, event, payload));
    } catch (e) {
      console.error(`webhook ${event} failed`, e);
    }
    const trigger = WORKFLOW_TRIGGER[event];
    if (trigger && typeof payload.id === "string") {
      try {
        await withTenant(tenantId, (tx) => runWorkflowsFor(tx, null, trigger as never, { type: "order", id: payload.id as string }));
      } catch (e) {
        console.error(`workflows for ${event} failed`, e);
      }
    }
    for (const h of extraHooks) {
      try {
        await h(tenantId, event, payload);
      } catch (e) {
        console.error(`listener for ${event} failed`, e);
      }
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
