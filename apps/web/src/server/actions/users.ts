"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, invitation, member, systemDb, user, type Tx } from "@rentevent/db";
import { ROLES } from "@rentevent/db/schema";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/adapters/email";
import { env } from "@/lib/env";
import { ROLE_LABELS } from "@/lib/permissions";
import { audit } from "../audit";
import { tenantAction, UserError } from "../action";
import { getAuthSession } from "../context";
import { assertSeatAvailable } from "../billing/tenant-access";

const INVITE_DAYS = 7;

async function sendInvite(inv: { id: string; email: string; role: string | null }, orgName: string, inviter: string) {
  const url = `${env.appUrl}/invitacion/${inv.id}`;
  await sendEmail({
    to: inv.email,
    subject: `${inviter} te invita a ${orgName} en Rentevent`,
    html: emailLayout({
      title: `Únete a ${orgName}`,
      body: `<p>${escapeHtml(inviter)} te ha invitado como <strong>${escapeHtml(ROLE_LABELS[(inv.role ?? "solo_lectura") as keyof typeof ROLE_LABELS] ?? "usuario")}</strong>. La invitación caduca en ${INVITE_DAYS} días.</p>`,
      cta: { label: "Aceptar invitación", url },
    }),
    text: `Acepta la invitación: ${url}`,
  });
  return url;
}

export const inviteUser = tenantAction(z.object({ email: z.string().trim().toLowerCase().email("Correo no válido"), role: z.enum(ROLES) }), "usuarios", async ({ email, role }, tx, ctx) => {
  const db = systemDb();
  const [already] = await db.select({ id: member.id }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.organizationId, ctx.tenantId), eq(user.email, email)));
  if (already) throw new UserError("Esa persona ya forma parte de la empresa.");
  await assertSeatAvailable(tx, ctx.tenantId, { email });
  await db.update(invitation).set({ status: "canceled" }).where(and(eq(invitation.organizationId, ctx.tenantId), eq(invitation.email, email), eq(invitation.status, "pending")));
  const id = randomBytes(16).toString("hex");
  await db.insert(invitation).values({ id, organizationId: ctx.tenantId, email, role, status: "pending", expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000), inviterId: ctx.user.id });
  const url = await sendInvite({ id, email, role }, ctx.tenantName, ctx.user.name);
  await audit(tx, ctx, "invitation", id, "crear", { email, role });
  revalidatePath("/app/configuracion/usuarios");
  return { id, url };
});

export const resendInvitation = tenantAction(z.object({ id: z.string().min(8) }), "usuarios", async ({ id }, tx, ctx) => {
  const db = systemDb();
  const [inv] = await db.select().from(invitation).where(and(eq(invitation.id, id), eq(invitation.organizationId, ctx.tenantId)));
  if (!inv) throw new UserError("Invitación no encontrada");
  await assertSeatAvailable(tx, ctx.tenantId, { invitationId: inv.id });
  await db.update(invitation).set({ status: "pending", expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) }).where(eq(invitation.id, id));
  await sendInvite(inv, ctx.tenantName, ctx.user.name);
  await audit(tx, ctx, "invitation", id, "enviar");
  revalidatePath("/app/configuracion/usuarios");
  return { id };
});

export const revokeInvitation = tenantAction(z.object({ id: z.string().min(8) }), "usuarios", async ({ id }, tx, ctx) => {
  await systemDb().update(invitation).set({ status: "canceled" }).where(and(eq(invitation.id, id), eq(invitation.organizationId, ctx.tenantId)));
  await audit(tx, ctx, "invitation", id, "borrar");
  revalidatePath("/app/configuracion/usuarios");
  return { id };
});

async function adminCount(tx: Tx) {
  return (await tx.select({ id: member.id }).from(member).where(eq(member.role, "administrador"))).length;
}

export const changeRole = tenantAction(z.object({ memberId: z.string().min(1), role: z.enum(ROLES) }), "usuarios", async ({ memberId, role }, tx, ctx) => {
  const [m] = await tx.select().from(member).where(eq(member.id, memberId));
  if (!m) throw new UserError("Usuario no encontrado");
  if (m.role === "administrador" && role !== "administrador" && (await adminCount(tx)) <= 1) throw new UserError("Debe quedar al menos un administrador.");
  await tx.update(member).set({ role }).where(eq(member.id, memberId));
  await audit(tx, ctx, "member", memberId, "editar", { rol: { de: m.role, a: role } });
  revalidatePath("/app/configuracion/usuarios");
  return { memberId };
});

export const removeMember = tenantAction(z.object({ memberId: z.string().min(1) }), "usuarios", async ({ memberId }, tx, ctx) => {
  const [m] = await tx.select().from(member).where(eq(member.id, memberId));
  if (!m) throw new UserError("Usuario no encontrado");
  if (m.userId === ctx.user.id) throw new UserError("No puedes quitarte a ti mismo.");
  if (m.role === "administrador" && (await adminCount(tx)) <= 1) throw new UserError("Debe quedar al menos un administrador.");
  await tx.delete(member).where(eq(member.id, memberId));
  await audit(tx, ctx, "member", memberId, "borrar");
  revalidatePath("/app/configuracion/usuarios");
  return { memberId };
});

/** Own profile (not tenant data). */
export async function updateProfile(input: { name: string; locale: string }) {
  const s = await getAuthSession();
  if (!s) return { ok: false as const, error: "Sesión caducada" };
  const p = z.object({ name: z.string().trim().min(2).max(80), locale: z.enum(["es", "en", "pt"]) }).safeParse(input);
  if (!p.success) return { ok: false as const, error: "Revisa el nombre" };
  await systemDb().update(user).set({ name: p.data.name, locale: p.data.locale, updatedAt: new Date() }).where(eq(user.id, s.user.id));
  revalidatePath("/app", "layout");
  return { ok: true as const };
}

