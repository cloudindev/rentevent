import "server-only";
import { env } from "../env";
import { planById, type PlanId } from "@/server/billing/plans";

/**
 * Billing adapter. Real mode uses Stripe Checkout + Billing Portal
 * (STRIPE_SECRET_KEY and STRIPE_PRICE_<PLAN>); simulated mode activates the
 * plan immediately so everything works locally without keys.
 */
export type CheckoutResult = { mode: "real"; url: string } | { mode: "simulado"; url: string };

async function stripe() {
  const Stripe = (await import("stripe")).default;
  return new Stripe(env.stripe!.secretKey);
}

export function priceIdFor(plan: PlanId, annual: boolean): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}${annual ? "_ANUAL" : ""}`;
  return process.env[key] ?? process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] ?? null;
}

export async function createCheckout(input: { tenantId: string; slug: string; email: string; plan: PlanId; seats: number; annual: boolean; customerId: string | null }): Promise<CheckoutResult> {
  const p = planById(input.plan);
  if (!p) throw new Error("Plan desconocido");
  const success = `${env.appUrl}/app/configuracion/suscripcion?ok=1`;
  const cancel = `${env.appUrl}/app/configuracion/suscripcion?cancelado=1`;
  if (!env.stripe) return { mode: "simulado", url: `/api/billing/simulado?plan=${input.plan}&seats=${input.seats}&annual=${input.annual ? 1 : 0}` };
  const price = priceIdFor(input.plan, input.annual);
  if (!price) throw new Error(`Falta la variable STRIPE_PRICE_${input.plan.toUpperCase()}`);
  const s = await stripe();
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: input.seats }],
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    client_reference_id: input.tenantId,
    subscription_data: { metadata: { tenantId: input.tenantId, plan: input.plan } },
    metadata: { tenantId: input.tenantId, plan: input.plan, seats: String(input.seats) },
    allow_promotion_codes: true,
    automatic_tax: { enabled: false },
    success_url: success,
    cancel_url: cancel,
  });
  return { mode: "real", url: session.url! };
}

export async function createPortal(customerId: string | null): Promise<string | null> {
  if (!env.stripe || !customerId) return null;
  const s = await stripe();
  const portal = await s.billingPortal.sessions.create({ customer: customerId, return_url: `${env.appUrl}/app/configuracion/suscripcion` });
  return portal.url;
}

export async function verifyStripeEvent(body: string, signature: string | null) {
  if (!env.stripe?.webhookSecret || !signature) throw new Error("Webhook de Stripe sin firma o sin secreto configurado");
  const s = await stripe();
  return s.webhooks.constructEvent(body, signature, env.stripe.webhookSecret);
}
