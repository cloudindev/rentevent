import { planById, PLANS, type PlanId } from "./plans";

export type BillingState = { plan: string; planSeats: number; subscriptionStatus: string; trialEndsAt: Date | null };

export type PlanAccess = {
  /** Free trial still running (no plan chosen yet): nothing is restricted. */
  trial: boolean;
  plan: PlanId | null;
  /** Users (members + live invitations) the company may have; null = no limit. */
  seatLimit: number | null;
  /** Public API, API keys and webhooks. */
  api: boolean;
};

/** Cheapest plan that includes a module, for "incluido en el plan …" messages. */
export const planWith = (module: string) => PLANS.find((p) => p.modules.includes(module)) ?? null;

/**
 * What the company's subscription allows. While the free trial runs (plan
 * "trial" and trialEndsAt in the future) everything is allowed so the trial
 * can try every feature. With a paid plan: the seats bought (never more than
 * the plan's maximum) and only the modules of that plan. An expired trial with
 * no plan has no paid modules (API off) and no seat limit to enforce.
 */
export function planAccess(s: BillingState | null | undefined, now = Date.now()): PlanAccess {
  if (!s) return { trial: true, plan: null, seatLimit: null, api: true };
  const p = planById(s.plan);
  if (!p) {
    const trial = s.plan === "trial" && (!s.trialEndsAt || s.trialEndsAt.getTime() > now);
    return { trial, plan: null, seatLimit: null, api: trial };
  }
  return { trial: false, plan: p.id, seatLimit: Math.max(1, Math.min(s.planSeats, p.seats)), api: p.modules.includes("api") };
}

/** Why a seat count can't be bought for a plan (null when it can): never below the current users nor above the plan maximum. */
export function seatsError(planId: string, seats: number, users: number): string | null {
  const p = planById(planId);
  if (!p) return "Plan no válido";
  if (!Number.isInteger(seats) || seats < 1) return "Indica un número de usuarios válido";
  if (seats < users) return `Ya tienes ${users} usuarios: no puedes contratar menos plazas. Quita usuarios en Usuarios y roles si necesitas menos.`;
  if (seats > p.seats) return `El plan ${p.name} admite hasta ${p.seats} usuarios.`;
  return null;
}
