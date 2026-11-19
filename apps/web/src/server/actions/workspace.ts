"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_TENANT_COOKIE, getAuthSession, getMemberships } from "../context";

export async function switchWorkspace(input: { tenantId: string }) {
  const { tenantId } = z.object({ tenantId: z.string().min(1) }).parse(input);
  const s = await getAuthSession();
  if (!s) return { ok: false as const };
  const m = (await getMemberships(s.user.id)).find((x) => x.tenantId === tenantId);
  if (!m) return { ok: false as const };
  (await cookies()).set(ACTIVE_TENANT_COOKIE, m.slug, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true as const };
}
