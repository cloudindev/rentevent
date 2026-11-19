import { and, asc, desc, eq, invitation, member, systemDb, tenantSettings, user } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { requireApp, tenantDb } from "@/server/context";
import { UsersManager } from "./users-manager";

export const metadata = { title: "Usuarios y roles" };

export default async function UsersPage() {
  const ctx = await requireApp("usuarios");
  const d = await tenantDb(async (tx) => ({
    members: await tx.select({ id: member.id, userId: member.userId, role: member.role, createdAt: member.createdAt, name: user.name, email: user.email }).from(member).innerJoin(user, eq(user.id, member.userId)).orderBy(asc(user.name)),
    fieldPermissions: ((await tx.select({ f: tenantSettings.fieldPermissions }).from(tenantSettings))[0]?.f ?? {}) as Record<string, Record<string, boolean>>,
  }));
  const invites = await systemDb().select().from(invitation).where(and(eq(invitation.organizationId, ctx.tenantId), eq(invitation.status, "pending"))).orderBy(desc(invitation.createdAt));
  return (
    <PageBody className="max-w-5xl">
      <UsersManager
        me={ctx.user.id}
        members={d.members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
        invitations={invites.map((i) => ({ id: i.id, email: i.email, role: i.role ?? "solo_lectura", expiresAt: i.expiresAt.toISOString() }))}
        fieldPermissions={d.fieldPermissions}
      />
    </PageBody>
  );
}
