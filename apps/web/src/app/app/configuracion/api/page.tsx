import { desc, apiKeys, webhookDeliveries, webhooks } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { env } from "@/lib/env";
import { tenantDb } from "@/server/context";
import { WEBHOOK_EVENTS } from "@/server/api/webhooks";
import { ApiManager } from "./api-manager";

export const metadata = { title: "API y webhooks" };

export default async function ApiPage() {
  const d = await tenantDb(async (tx) => ({
    keys: await tx.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)),
    hooks: await tx.select().from(webhooks).orderBy(desc(webhooks.createdAt)),
    deliveries: await tx.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(25),
  }), "configuracion");
  return (
    <PageBody className="max-w-5xl">
      <ApiManager
        baseUrl={`${env.appUrl}/api/v1`}
        events={[...WEBHOOK_EVENTS]}
        keys={d.keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, createdBy: k.createdBy, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null }))}
        hooks={d.hooks.map((h) => ({ id: h.id, url: h.url, events: h.events, active: h.active }))}
        deliveries={d.deliveries.map((x) => ({ id: x.id, webhookId: x.webhookId, event: x.event, status: x.status, attempts: x.attempts, error: x.error, createdAt: x.createdAt.toISOString(), delivered: Boolean(x.deliveredAt) }))}
      />
    </PageBody>
  );
}
