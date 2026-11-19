import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { and, eq, gt, invitation, organization, systemDb } from "@rentevent/db";
import { AuthSplit } from "@/components/auth-split";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@rentevent/db/schema";
import { getAuthSession, getMemberships } from "@/server/context";
import { WorkspaceButton } from "./workspace-button";

export const metadata: Metadata = { title: "Espacios de trabajo" };

export default async function WorkspacesPage() {
  const s = await getAuthSession();
  if (!s) redirect("/acceso?next=/espacios");
  const memberships = await getMemberships(s.user.id);
  const invites = await systemDb()
    .select({ id: invitation.id, org: organization.name, role: invitation.role })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(and(eq(invitation.email, s.user.email), eq(invitation.status, "pending"), gt(invitation.expiresAt, new Date())));
  return (
    <AuthSplit>
      <h1 className="text-2xl font-semibold">Elige un espacio de trabajo</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{s.user.email}</p>
      <div className="space-y-2">
        {memberships.map((m) => (
          <WorkspaceButton key={m.tenantId} tenantId={m.tenantId} name={m.name} role={ROLE_LABELS[m.role as Role] ?? m.role} />
        ))}
        {invites.map((i) => (
          <Link key={i.id} href={`/invitacion/${i.id}`} className="flex items-center justify-between rounded-xl border border-dashed px-4 py-3 text-sm hover:bg-subtle">
            <span>
              Invitación a <strong>{i.org}</strong>
            </span>
            <span className="text-link">Ver</span>
          </Link>
        ))}
        <Link href="/registro/empresa" className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm hover:bg-subtle">
          <Plus className="size-4" /> Crear una empresa nueva
        </Link>
      </div>
    </AuthSplit>
  );
}
