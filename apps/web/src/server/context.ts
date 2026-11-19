import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { asc, eq, member, organization, systemDb, tenantSettings, withTenant, type Tx } from "@rentevent/db";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

export const ACTIVE_TENANT_COOKIE = "rv_tenant";

export const getAuthSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
});

export type Membership = { tenantId: string; slug: string; name: string; logo: string | null; role: string };
type MembershipRow = Membership & { settings: typeof tenantSettings.$inferSelect | null };

/** Memberships with each tenant's settings in a single query (one round trip per request). */
const getMembershipRows = cache(async (userId: string): Promise<MembershipRow[]> => {
  return systemDb()
    .select({ tenantId: organization.id, slug: organization.slug, name: organization.name, logo: organization.logo, role: member.role, settings: tenantSettings })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));
});

export const getMemberships = cache(async (userId: string): Promise<Membership[]> =>
  (await getMembershipRows(userId)).map(({ settings: _settings, ...m }) => m),
);

export type AppContext = {
  user: { id: string; name: string; email: string; image: string | null; twoFactorEnabled: boolean };
  sessionId: string;
  tenantId: string;
  slug: string;
  tenantName: string;
  tenantLogo: string | null;
  role: string;
  memberships: Membership[];
  fieldPermissions: Record<string, Record<string, boolean>>;
  onboardingDone: boolean;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
};

export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const s = await getAuthSession();
  if (!s) return null;
  const rows = await getMembershipRows(s.user.id);
  if (rows.length === 0) return null;
  const memberships = await getMemberships(s.user.id);
  const h = await headers();
  const c = await cookies();
  const wanted = h.get("x-tenant-slug") ?? c.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  const m = rows.find((x) => x.slug === wanted || x.tenantId === wanted) ?? rows[0]!;
  const settings = m.settings;
  return {
    user: { id: s.user.id, name: s.user.name, email: s.user.email, image: s.user.image ?? null, twoFactorEnabled: Boolean((s.user as { twoFactorEnabled?: boolean }).twoFactorEnabled) },
    sessionId: s.session.id,
    tenantId: m.tenantId,
    slug: m.slug,
    tenantName: m.name,
    tenantLogo: settings?.logoUrl ?? m.logo,
    role: m.role,
    memberships,
    fieldPermissions: (settings?.fieldPermissions as Record<string, Record<string, boolean>>) ?? {},
    onboardingDone: settings?.onboardingDone ?? true,
    subscriptionStatus: settings?.subscriptionStatus ?? "trialing",
    trialEndsAt: settings?.trialEndsAt ?? null,
  };
});

/** For pages: redirects to login / workspace creation when needed. */
export async function requireApp(permission: Permission = "ver"): Promise<AppContext> {
  const s = await getAuthSession();
  if (!s) redirect("/acceso");
  const ctx = await getAppContext();
  if (!ctx) redirect("/registro/empresa");
  if (!can(ctx.role, permission)) {
    if (ctx.role === "montador") redirect("/m");
    redirect("/app/inicio?denegado=1");
  }
  return ctx;
}

/** Run tenant-scoped queries under RLS. */
export async function tenantDb<T>(fn: (tx: Tx, ctx: AppContext) => Promise<T>, permission: Permission = "ver"): Promise<T> {
  const ctx = await requireApp(permission);
  return withTenant(ctx.tenantId, (tx) => fn(tx, ctx));
}
