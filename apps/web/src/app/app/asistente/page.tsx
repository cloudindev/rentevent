import { Sparkles } from "lucide-react";
import { aiMessages, and, asc, desc, eq } from "@rentevent/db";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { aiProvider } from "@/lib/adapters/ai";
import { tenantDb } from "@/server/context";
import type { ChatMessageView } from "@/server/actions/ai";
import { AssistantChat } from "./chat";

export const metadata = { title: "Asistente" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const d = await tenantDb(async (tx, ctx) => {
    const all = await tx
      .select({ conversationId: aiMessages.conversationId, content: aiMessages.content, role: aiMessages.role, createdAt: aiMessages.createdAt })
      .from(aiMessages)
      .where(eq(aiMessages.userId, ctx.user.id))
      .orderBy(desc(aiMessages.createdAt))
      .limit(400);
    const convs = new Map<string, { id: string; title: string; updatedAt: string }>();
    for (const m of [...all].reverse()) {
      const c = convs.get(m.conversationId);
      if (!c) convs.set(m.conversationId, { id: m.conversationId, title: m.role === "user" ? m.content.slice(0, 60) : "Conversación", updatedAt: m.createdAt.toISOString() });
      else c.updatedAt = m.createdAt.toISOString();
    }
    const active = sp.c && convs.has(sp.c) ? sp.c : null;
    const messages = active
      ? await tx.select().from(aiMessages).where(and(eq(aiMessages.conversationId, active), eq(aiMessages.userId, ctx.user.id))).orderBy(asc(aiMessages.createdAt))
      : [];
    return {
      conversations: [...convs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      active,
      messages: messages.map(
        (m): ChatMessageView => ({ id: m.id, role: m.role as "user", content: m.content, links: ((m.data as { links?: ChatMessageView["links"] } | null)?.links ?? []), createdAt: m.createdAt.toISOString() }),
      ),
      name: ctx.user.name.split(" ")[0] ?? "",
    };
  });
  const provider = aiProvider();
  return (
    <>
      <PageHeader icon={Sparkles} title="Preguntar al asistente">
        <StatusPill tone={provider === "anthropic" ? "success" : "neutral"}>{provider === "anthropic" ? "Claude" : "Modo simulado"}</StatusPill>
      </PageHeader>
      <AssistantChat key={d.active ?? "new"} conversations={d.conversations} activeId={d.active} initial={d.messages} firstName={d.name} />
    </>
  );
}
