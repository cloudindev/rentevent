"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { formatDateTime, initials } from "@/lib/utils";
import { addNote } from "@/server/actions/contacts";

export type NoteView = { id: string; body: string; authorName: string | null; createdAt: string };

export function NotesPanel({ entity, entityId, notes, path }: { entity: "contact" | "project" | "order" | "item"; entityId: string; notes: NoteView[]; path: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          start(async () => {
            await addNote({ entity, entityId, body, path });
            setBody("");
            router.refresh();
          });
        }}
      >
        <Textarea aria-label="Nueva nota" placeholder="Escribe una nota interna…" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-10" rows={1} />
        <Button size="icon" aria-label="Guardar nota" disabled={pending || !body.trim()}>
          <Send />
        </Button>
      </form>
      {notes.length === 0 && <p className="text-sm text-muted-foreground">Sin notas.</p>}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">{initials(n.authorName ?? "?")}</span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.authorName}</span> · {formatDateTime(n.createdAt)}
              </p>
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
