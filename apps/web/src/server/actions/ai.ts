"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { aiMessages, and, asc, eq, withTenant } from "@rentevent/db";
import { runAssistant, type ChatTurn } from "@/lib/adapters/ai";
import { getAppContext } from "../context";

export type ChatMessageView = { id: string; role: "user" | "assistant"; content: string; links: { label: string; href: string }[]; createdAt: string };

export async function sendAssistantMessage(input: { conversationId: string | null; text: string }): Promise<{ ok: true; conversationId: string; reply: ChatMessageView } | { ok: false; error: string }> {
  const ctx = await getAppContext();
  if (!ctx) return { ok: false, error: "Tu sesión ha caducado." };
  const parsed = z.object({ conversationId: z.string().uuid().nullable(), text: z.string().trim().min(1).max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe una pregunta (máximo 2000 caracteres)." };
  const conversationId = parsed.data.conversationId ?? randomUUID();
  const history = await withTenant(ctx.tenantId, async (tx) => {
    const rows = await tx
      .select({ role: aiMessages.role, content: aiMessages.content })
      .from(aiMessages)
      .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, ctx.user.id)))
      .orderBy(asc(aiMessages.createdAt));
    await tx.insert(aiMessages).values({ userId: ctx.user.id, conversationId, role: "user", content: parsed.data.text });
    return rows as ChatTurn[];
  });
  const reply = await runAssistant(ctx, history, parsed.data.text);
  const [row] = await withTenant(ctx.tenantId, (tx) =>
    tx
      .insert(aiMessages)
      .values({ userId: ctx.user.id, conversationId, role: "assistant", content: reply.text, data: { links: reply.links, toolCalls: reply.toolCalls, provider: reply.provider } })
      .returning(),
  );
  revalidatePath("/app/asistente");
  return { ok: true, conversationId, reply: { id: row!.id, role: "assistant", content: reply.text, links: reply.links, createdAt: row!.createdAt.toISOString() } };
}

export async function deleteConversation(conversationId: string) {
  const ctx = await getAppContext();
  if (!ctx || !z.string().uuid().safeParse(conversationId).success) return { ok: false as const };
  await withTenant(ctx.tenantId, (tx) => tx.delete(aiMessages).where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, ctx.user.id))));
  revalidatePath("/app/asistente");
  return { ok: true as const };
}
