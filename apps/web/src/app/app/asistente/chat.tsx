"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateTime, initials } from "@/lib/utils";
import { deleteConversation, sendAssistantMessage, type ChatMessageView } from "@/server/actions/ai";
import { RichText } from "./rich-text";

const SUGGESTIONS = [
  "¿Qué carpa puedo montar del 12 al 15 de diciembre?",
  "¿Quién está libre el sábado 12 de diciembre?",
  "¿Cuántas cerchas de 10 m hay libres el 12 de diciembre?",
  "Pedidos de la semana que viene",
  "¿Cuánto hemos facturado este mes?",
  "Crea un pedido de una carpa 10x20 para el 12 de diciembre para Hotel Playa Mayor",
];

export function AssistantChat({ conversations, activeId, initial, firstName }: { conversations: { id: string; title: string; updatedAt: string }[]; activeId: string | null; initial: ChatMessageView[]; firstName: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [conversationId, setConversationId] = useState(activeId);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const send = (q: string) => {
    const value = q.trim();
    if (!value || pending) return;
    setError(null);
    setText("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: value, links: [], createdAt: new Date().toISOString() }]);
    start(async () => {
      const r = await sendAssistantMessage({ conversationId, text: value });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMessages((m) => [...m, r.reply]);
      if (!conversationId) {
        setConversationId(r.conversationId);
        router.replace(`/app/asistente?c=${r.conversationId}`, { scroll: false });
      }
    });
  };

  return (
    <div className="grid h-[calc(100%-57px)] min-h-[520px] md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden flex-col border-r md:flex" aria-label="Conversaciones">
        <div className="p-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/app/asistente">
              <MessageSquarePlus /> Nueva conversación
            </Link>
          </Button>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {conversations.length === 0 && <li className="px-2 py-3 text-xs text-muted-foreground">Aún no hay conversaciones.</li>}
          {conversations.map((c) => (
            <li key={c.id} className="group flex items-center">
              <Link href={`/app/asistente?c=${c.id}`} className={cn("min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-sm hover:bg-accent", c.id === conversationId && "bg-accent font-medium")}>
                {c.title}
              </Link>
              <button
                aria-label="Borrar conversación"
                className="invisible rounded p-1 text-muted-foreground hover:text-danger group-hover:visible"
                onClick={async () => {
                  await deleteConversation(c.id);
                  if (c.id === conversationId) router.push("/app/asistente");
                  else router.refresh();
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8" aria-live="polite">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.length === 0 && (
              <div className="pt-8 text-center">
                <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
                  <Sparkles className="size-5 text-brand-600" />
                </div>
                <h2 className="mt-3 text-xl font-semibold">Hola{firstName ? `, ${firstName}` : ""}. ¿Qué necesitas saber?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pregunta por carpas, stock, personal, pedidos o facturación. También puedo preparar borradores de pedido.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-left text-[13px] hover:bg-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", m.role === "user" ? "bg-secondary" : "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300")}>
                  {m.role === "user" ? initials(firstName || "Tú") : <Sparkles className="size-3.5" />}
                </span>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", m.role === "user" ? "bg-secondary" : "border bg-card")}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <RichText text={m.content} />}
                  {m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent">
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(m.createdAt)}</p>
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex gap-3" role="status" aria-label="El asistente está respondiendo">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
                  <Sparkles className="size-3.5 text-brand-600" />
                </span>
                <div className="w-64 space-y-2 rounded-2xl border p-4">
                  <Skeleton className="h-3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
            <div ref={endRef} />
          </div>
        </div>
        <form
          className="border-t p-3 md:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-background p-2 focus-within:outline-2 focus-within:outline-ring">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={1}
              placeholder="Pregunta algo… (Intro para enviar)"
              aria-label="Mensaje para el asistente"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <Button size="icon" aria-label="Enviar" disabled={pending || !text.trim()}>
              <ArrowUp />
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
