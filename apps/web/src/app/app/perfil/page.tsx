import { User } from "lucide-react";
import { eq, systemDb, user } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { ROLE_LABELS } from "@/lib/permissions";
import type { Role } from "@rentevent/db/schema";
import { requireApp } from "@/server/context";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Perfil y seguridad" };

export default async function ProfilePage() {
  const ctx = await requireApp();
  const [u] = await systemDb().select({ locale: user.locale, twoFactorEnabled: user.twoFactorEnabled, createdAt: user.createdAt }).from(user).where(eq(user.id, ctx.user.id));
  return (
    <>
      <PageHeader icon={User} title="Perfil y seguridad" subtitle={`${ROLE_LABELS[ctx.role as Role] ?? ctx.role} en ${ctx.tenantName}`} />
      <PageBody className="max-w-3xl">
        <ProfileClient name={ctx.user.name} email={ctx.user.email} locale={u?.locale ?? "es"} twoFactor={Boolean(u?.twoFactorEnabled)} currentSessionId={ctx.sessionId} />
      </PageBody>
    </>
  );
}
