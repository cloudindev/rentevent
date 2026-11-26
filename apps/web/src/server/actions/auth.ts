"use server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { and, eq, invitation, member, organization, systemDb, user } from "@rentevent/db";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { acceptSeatProblem } from "../billing/tenant-access";
import { ACTIVE_TENANT_COOKIE, getAuthSession } from "../context";
import { normaliseSlug, provisionTenant, slugAvailable } from "../provisioning";

const registerSchema = z.object({
  company: z.string().trim().min(2, "Indica el nombre de la empresa").max(80),
  slug: z.string().trim().min(3, "Mínimo 3 caracteres").max(32),
  name: z.string().trim().min(2, "Indica tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(10, "Mínimo 10 caracteres").max(128),
  terms: z.literal(true, { message: "Debes aceptar los términos" }),
});

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; data?: Record<string, string> };

export async function checkSlug(raw: string) {
  const slug = normaliseSlug(raw);
  return { slug, available: await slugAvailable(slug) };
}

export async function registerCompany(input: z.input<typeof registerSchema>): Promise<FormState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }
  const d = parsed.data;
  const slug = normaliseSlug(d.slug);
  if (!(await slugAvailable(slug))) return { ok: false, fieldErrors: { slug: "Ese subdominio ya está en uso" } };
  const [existing] = await systemDb().select({ id: user.id }).from(user).where(eq(user.email, d.email));
  if (existing) return { ok: false, fieldErrors: { email: "Ya existe una cuenta con este correo. Inicia sesión." } };
  const res = await auth.api.signUpEmail({ body: { name: d.name, email: d.email, password: d.password, callbackURL: "/app/onboarding" } });
  await provisionTenant({ name: d.company, slug, userId: res.user.id, email: d.email });
  return { ok: true, data: { email: d.email, slug } };
}

export async function createCompanyForCurrentUser(input: { company: string; slug: string }): Promise<FormState> {
  const s = await getAuthSession();
  if (!s) return { ok: false, error: "Inicia sesión primero." };
  const company = z.string().trim().min(2).max(80).safeParse(input.company);
  if (!company.success) return { ok: false, fieldErrors: { company: "Indica el nombre de la empresa" } };
  const slug = normaliseSlug(input.slug || input.company);
  if (!(await slugAvailable(slug))) return { ok: false, fieldErrors: { slug: "Ese subdominio ya está en uso" } };
  const t = await provisionTenant({ name: company.data, slug, userId: s.user.id, email: s.user.email });
  (await cookies()).set(ACTIVE_TENANT_COOKIE, t.slug, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return { ok: true, data: { slug: t.slug } };
}

export async function invitationInfo(id: string) {
  const [row] = await systemDb()
    .select({ id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, orgName: organization.name, slug: organization.slug, orgId: organization.id })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, id));
  return row ?? null;
}

export async function acceptInvitation(id: string): Promise<FormState> {
  const s = await getAuthSession();
  if (!s) return { ok: false, error: "Inicia sesión para aceptar la invitación." };
  const inv = await invitationInfo(id);
  if (!inv || inv.status !== "pending") return { ok: false, error: "La invitación ya no es válida." };
  if (inv.expiresAt < new Date()) return { ok: false, error: "La invitación ha caducado. Pide una nueva." };
  if (inv.email.toLowerCase() !== s.user.email.toLowerCase()) return { ok: false, error: `Esta invitación es para ${inv.email}. Entra con esa cuenta.` };
  const db = systemDb();
  const [already] = await db.select().from(member).where(and(eq(member.organizationId, inv.orgId), eq(member.userId, s.user.id)));
  if (!already) {
    const full = await acceptSeatProblem(inv.orgId);
    if (full) return { ok: false, error: full };
  }
  if (!already) await db.insert(member).values({ id: `mem_${randomBytes(10).toString("hex")}`, organizationId: inv.orgId, userId: s.user.id, role: inv.role ?? "solo_lectura" });
  await db.update(invitation).set({ status: "accepted" }).where(eq(invitation.id, id));
  (await cookies()).set(ACTIVE_TENANT_COOKIE, inv.slug, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return { ok: true, data: { slug: inv.slug } };
}

export async function signUpInvited(input: { invitationId: string; name: string; password: string }): Promise<FormState> {
  const inv = await invitationInfo(input.invitationId);
  if (!inv || inv.status !== "pending" || inv.expiresAt < new Date()) return { ok: false, error: "La invitación ya no es válida." };
  if (input.password.length < 10) return { ok: false, fieldErrors: { password: "Mínimo 10 caracteres" } };
  if (input.name.trim().length < 2) return { ok: false, fieldErrors: { name: "Indica tu nombre" } };
  const full = await acceptSeatProblem(inv.orgId);
  if (full) return { ok: false, error: full };
  const [existing] = await systemDb().select({ id: user.id }).from(user).where(eq(user.email, inv.email));
  if (existing) return { ok: false, error: "Ya tienes cuenta con este correo: inicia sesión para aceptar." };
  await auth.api.signUpEmail({ body: { name: input.name.trim(), email: inv.email, password: input.password, callbackURL: `/invitacion/${inv.id}` }, headers: await headers() });
  return { ok: true, data: { email: inv.email } };
}
