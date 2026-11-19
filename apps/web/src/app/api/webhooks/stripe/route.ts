import { eq, systemDb, tenantSettings } from "@rentevent/db";
import { verifyStripeEvent } from "@/lib/adapters/payments";
import { planById } from "@/server/billing/plans";

type Sub = { id: string; customer: string; status: string; metadata?: Record<string, string>; items?: { data: { quantity?: number }[] } };

/** Stripe Billing webhook: keeps tenant_settings in sync with the subscription. */
export async function POST(req: Request) {
  const body = await req.text();
  let event;
  try {
    event = await verifyStripeEvent(body, req.headers.get("stripe-signature"));
  } catch (e) {
    return new Response(`Firma no válida: ${e instanceof Error ? e.message : "error"}`, { status: 400 });
  }
  const db = systemDb();
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as { client_reference_id?: string; customer?: string; subscription?: string; metadata?: Record<string, string> };
    const tenantId = s.client_reference_id ?? s.metadata?.tenantId;
    if (tenantId) {
      const plan = planById(s.metadata?.plan ?? "") ? s.metadata!.plan! : "profesional";
      await db.update(tenantSettings).set({ stripeCustomerId: s.customer ?? null, stripeSubscriptionId: s.subscription ?? null, plan, planSeats: Number(s.metadata?.seats ?? 5), subscriptionStatus: "active", modules: planById(plan)!.modules }).where(eq(tenantSettings.tenantId, tenantId));
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as unknown as Sub;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
    const tenantId = sub.metadata?.tenantId;
    const where = tenantId ? eq(tenantSettings.tenantId, tenantId) : eq(tenantSettings.stripeCustomerId, sub.customer);
    await db.update(tenantSettings).set({ subscriptionStatus: status, stripeSubscriptionId: sub.id, planSeats: sub.items?.data[0]?.quantity ?? undefined }).where(where);
  } else if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as { customer?: string };
    if (inv.customer) await db.update(tenantSettings).set({ subscriptionStatus: "past_due" }).where(eq(tenantSettings.stripeCustomerId, inv.customer));
  }
  return Response.json({ received: true });
}
