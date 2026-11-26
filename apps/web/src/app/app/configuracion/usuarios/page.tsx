import { and, asc, desc, eq, invitation, member, systemDb, tenantSettings, user } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { now } from "@/lib/now";
import { requireApp, tenantDb } from "@/server/context";
import { loadPlanAccess, seatsInUse } from "@/server/billing/tenant-access";
import { UsersManager } from "./users-manager";

export const metadata = { title: "Usuarios y roles" };

export default async function UsersPage() {
  const ctx = await requireApp("usuarios");
  const d = await tenantDb(async (tx) => ({
    members: await tx.select({ id: member.id, userId: member.userId, role: member.role, createdAt: member.createdAt, name: user.name, email: user.email }).from(member).innerJoin(user, eq(user.id, member.userId)).orderBy(asc(user.name)),
    access: await loadPlanAccess(tx),
    fieldPermissions: ((await tx.select({ f: tenantSettings.fieldPermissions }).from(tenantSettings))[0]?.f ?? {}) as Record<string, Record<string, boolean>>,
  }));
  const nowMs = now();
  // still "pending" in the table once expiresAt has passed: shown as Caducada (Reenviar renews it)
  const invites = await systemDb().select().from(invitation).where(and(eq(invitation.organizationId, ctx.tenantId), eq(invitation.status, "pending"))).orderBy(desc(invitation.createdAt));
  const used = d.access.seatLimit != null ? await seatsInUse(ctx.tenantId) : null;
  return (
    <PageBody className="max-w-5xl">
      <UsersManager
        me={ctx.user.id}
        members={d.members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        invitations={invites.map((i) => ({ id: i.id, email: i.email, role: i.role ?? "solo_lectura", expiresAt: i.expiresAt.toISOString(), expired: i.expiresAt.getTime() < nowMs }))}
        fieldPermissions={d.fieldPermissions}
        seats={used && d.access.seatLimit != null ? { used: used.members + used.invitations, limit: d.access.seatLimit } : null}
      />
    </PageBody>
  );
}
