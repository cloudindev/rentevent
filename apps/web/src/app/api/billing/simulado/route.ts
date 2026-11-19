import { NextResponse } from "next/server";
import { tenantSettings, withTenant } from "@rentevent/db";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { planById } from "@/server/billing/plans";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";

/** Simulated checkout (no Stripe keys): activates the chosen plan immediately. */
export async function GET(req: Request) {
  const ctx = await getAppContext();
  const u = new URL(req.url);
  if (!ctx || !can(ctx.role, "configuracion")) return NextResponse.redirect(new URL("/acceso", env.appUrl));
  if (env.stripe) return new Response("Pagos reales configurados: usa Stripe Checkout", { status: 400 });
  const plan = planById(u.searchParams.get("plan") ?? "");
  if (!plan || plan.id === "empresa") return new Response("Plan no válido", { status: 400 });
  const seats = Math.min(500, Math.max(1, Number(u.searchParams.get("seats") ?? 5)));
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.update(tenantSettings).set({ plan: plan.id, planSeats: seats, subscriptionStatus: "active", modules: plan.modules, stripeCustomerId: null });
    await audit(tx, ctx, "subscription", ctx.tenantId, "editar", { plan: plan.id, seats, modo: "simulado", anual: u.searchParams.get("annual") === "1" });
  });
  return NextResponse.redirect(new URL("/app/configuracion/suscripcion?ok=1&simulado=1", req.url));
}
