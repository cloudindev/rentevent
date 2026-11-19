import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, pushSubscriptions, withTenant } from "@rentevent/db";
import { getAppContext } from "@/server/context";

const body = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function POST(req: Request) {
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Suscripción no válida" }, { status: 400 });
  await withTenant(ctx.tenantId, (tx) =>
    tx
      .insert(pushSubscriptions)
      .values({ userId: ctx.user.id, endpoint: parsed.data.endpoint, keys: parsed.data.keys })
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: ctx.user.id, keys: parsed.data.keys } }),
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await withTenant(ctx.tenantId, (tx) => tx.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)));
  return NextResponse.json({ ok: true });
}
