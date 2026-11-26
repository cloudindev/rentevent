import "server-only";
import { and, eq, gt, invitation, member, ne, sql, systemDb, tenantSettings, type Tx } from "@rentevent/db";
import { UserError } from "../action";
import { planAccess, planWith, type PlanAccess } from "./access";

/** The current company's plan access (reads tenant settings under RLS). */
export async function loadPlanAccess(tx: Tx): Promise<PlanAccess> {
  const [s] = await tx
    .select({ plan: tenantSettings.plan, planSeats: tenantSettings.planSeats, subscriptionStatus: tenantSettings.subscriptionStatus, trialEndsAt: tenantSettings.trialEndsAt })
    .from(tenantSettings);
  return planAccess(s);
}

type Except = { invitationId?: string; email?: string };

/** Members plus invitations that can still be accepted (ignoring the invitation being re-sent or replaced). */
export async function seatsInUse(tenantId: string, except: Except = {}) {
  const db = systemDb();
  const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(member).where(eq(member.organizationId, tenantId));
  const conds = [eq(invitation.organizationId, tenantId), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())];
  if (except.invitationId) conds.push(ne(invitation.id, except.invitationId));
  if (except.email) conds.push(ne(invitation.email, except.email));
  const [i] = await db.select({ n: sql<number>`count(*)::int` }).from(invitation).where(and(...conds));
  return { members: m?.n ?? 0, invitations: i?.n ?? 0 };
}

/** Throws when inviting one more person would exceed the seats of the plan. */
export async function assertSeatAvailable(tx: Tx, tenantId: string, except: Except = {}) {
  const access = await loadPlanAccess(tx);
  if (access.seatLimit == null) return;
  const used = await seatsInUse(tenantId, except);
  if (used.members + used.invitations >= access.seatLimit) {
    const pending = used.invitations ? ` y ${used.invitations} invitación${used.invitations === 1 ? "" : "es"} pendiente${used.invitations === 1 ? "" : "s"}` : "";
    throw new UserError(
      `Tu plan incluye ${access.seatLimit} usuario${access.seatLimit === 1 ? "" : "s"} y ya tienes ${used.members}${pending}. Amplía las plazas en Configuración > Suscripción${pending ? " o anula una invitación" : ""}.`,
    );
  }
}

/** Throws unless the plan includes the public API and webhooks. */
export async function assertApiIncluded(tx: Tx) {
  const access = await loadPlanAccess(tx);
  if (!access.api) throw new UserError(`La API y los webhooks están incluidos en el plan ${planWith("api")?.name ?? "Empresa"}.`);
}
