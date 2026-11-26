import Link from "next/link";
import { KeyRound } from "lucide-react";
import { desc, apiKeys, webhookDeliveries, webhooks } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { loadPlanAccess } from "@/server/billing/tenant-access";
import { planWith } from "@/server/billing/access";
import { env } from "@/lib/env";
import { tenantDb } from "@/server/context";
import { WEBHOOK_EVENTS } from "@/server/api/webhooks";
import { ApiManager } from "./api-manager";

export const metadata = { title: "API y webhooks" };

export default async function ApiPage() {
  const d = await tenantDb(async (tx) => ({
    access: await loadPlanAccess(tx),
    keys: await tx.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)),
    hooks: await tx.select().from(webhooks).orderBy(desc(webhooks.createdAt)),
    deliveries: await tx.select().from(webhookDeliveries).orderBy(desc(webhookDeliveries.createdAt)).limit(25),
  }), "configuracion");
  if (!d.access.api) {
    // API keys stop working and webhooks stop firing outside the plan that includes them (see withApiKey / dispatchWebhook)
    const plan = planWith("api")?.name ?? "Empresa";
    return (
      <PageBody className="max-w-5xl">
        <EmptyState
          icon={KeyRound}
          title={`La API y los webhooks están incluidos en el plan ${plan}`}
          description={
            d.keys.some((k) => !k.revokedAt) || d.hooks.length > 0
              ? `Tus claves y webhooks se conservan, pero no funcionan con tu plan actual. Pásate al plan ${plan} para volver a usarlos.`
              : `Conecta Rentevent con tu web, tu ERP o tus automatizaciones con el plan ${plan}.`
          }
          action={
            <Button asChild size="sm">
              <Link href="/app/configuracion/suscripcion">Ver planes</Link>
            </Button>
          }
        />
      </PageBody>
    );
  }
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
