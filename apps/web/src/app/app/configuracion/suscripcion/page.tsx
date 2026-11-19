import { member, sql, tenantSettings } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { env } from "@/lib/env";
import { tenantDb } from "@/server/context";
import { SubscriptionPanel } from "./subscription-panel";

export const metadata = { title: "Suscripción" };

const daysUntil = (d: Date | null) => (d ? Math.ceil((d.getTime() - Date.now()) / 86_400_000) : null);

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ ok?: string; cancelado?: string; simulado?: string }> }) {
  const sp = await searchParams;
  const d = await tenantDb(async (tx) => ({
    s: (await tx.select().from(tenantSettings))[0],
    users: (await tx.select({ n: sql<number>`count(*)::int` }).from(member))[0]?.n ?? 1,
  }), "configuracion");
  return (
    <PageBody className="max-w-5xl">
      <SubscriptionPanel
        plan={d.s?.plan ?? "trial"}
        status={d.s?.subscriptionStatus ?? "trialing"}
        seats={d.s?.planSeats ?? 5}
        users={d.users}
        trialEndsAt={d.s?.trialEndsAt?.toISOString() ?? null}
        daysLeft={daysUntil(d.s?.trialEndsAt ?? null)}
        hasPortal={Boolean(env.stripe && d.s?.stripeCustomerId)}
        simulated={!env.stripe}
        flash={sp.ok ? (sp.simulado ? "Plan activado (pago simulado: no se ha cobrado nada)." : "¡Gracias! Tu suscripción está activa.") : sp.cancelado ? "Has cancelado el pago; tu plan no ha cambiado." : null}
      />
    </PageBody>
  );
}
