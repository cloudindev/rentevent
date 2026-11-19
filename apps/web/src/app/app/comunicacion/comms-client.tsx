"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/menu";
import { Card, CardContent } from "@/components/ui/card";
import { deleteAnnouncement, saveAnnouncement, sendTeamNotice } from "@/server/actions/comms";

type Ann = { id: string | null; title: string; body: string; pinned: boolean };

function AnnouncementDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial: Ann }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{v.id ? "Editar aviso" : "Nuevo aviso"}</DialogTitle></DialogHeader>
        <Field label="Título" htmlFor="a-title" error={errors.title}><Input id="a-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Mensaje" htmlFor="a-body" error={errors.body}><Textarea id="a-body" rows={6} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={v.pinned} onCheckedChange={(x) => setV({ ...v, pinned: x })} /> Fijar arriba</label>
        <DialogFooter>
          <Button disabled={pending} onClick={() => start(async () => { const r = await saveAnnouncement(v); if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; } onOpenChange(false); router.refresh(); })}>Publicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewAnnouncement() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus /> Nuevo aviso</Button>
      {open && <AnnouncementDialog open={open} onOpenChange={setOpen} initial={{ id: null, title: "", body: "", pinned: false }} />}
    </>
  );
}

export function AnnouncementActions({ a }: { a: Ann & { id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="icon-sm" variant="ghost" aria-label="Editar aviso" onClick={() => setOpen(true)}><Pencil /></Button>
      <Button size="icon-sm" variant="ghost" aria-label="Eliminar aviso" disabled={pending} onClick={() => confirm("¿Eliminar el aviso?") && start(async () => { await deleteAnnouncement({ id: a.id }); router.refresh(); })}><Trash2 /></Button>
      {open && <AnnouncementDialog open={open} onOpenChange={setOpen} initial={a} />}
    </div>
  );
}

const CHANNELS = [
  { key: "push", label: "Push (app)" },
  { key: "email", label: "Correo" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "interno", label: "Interno" },
] as const;

export function NoticeComposer({ team }: { team: { id: string; name: string; email: string | null; phone: string | null; skills: string[] }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<string[]>(["push"]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pin, setPin] = useState(false);
  const [pending, start] = useTransition();
  const allSelected = selected.size === team.length && team.length > 0;
  return (
    <Card>
      <CardContent className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Field label="Título" htmlFor="n-title"><Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cambio de hora de carga del sábado" /></Field>
          <Field label="Mensaje" htmlFor="n-body"><Textarea id="n-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium">Canales</legend>
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={channels.includes(c.key)} onCheckedChange={(v) => setChannels((cs) => (v ? [...cs, c.key] : cs.filter((x) => x !== c.key)))} /> {c.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Sin claves configuradas, el envío queda registrado como simulado.</p>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><Switch checked={pin} onCheckedChange={setPin} /> Publicar también como aviso fijado</label>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sendTeamNotice({ title, body, channels: channels as ("push" | "email" | "whatsapp" | "interno")[], workerIds: [...selected], pin });
                if (!r.ok) {
                  toast.error(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
                  return;
                }
                toast.success(`${r.data.sent} envío(s) registrados${r.data.skipped ? ` · ${r.data.skipped} sin dato de contacto` : ""}`);
                setTitle("");
                setBody("");
                setSelected(new Set());
                router.push("/app/comunicacion?tab=registro");
              })
            }
          >
            <Send /> Enviar a {selected.size} persona{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
        <div className="rounded-xl border">
          <label className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
            <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(team.map((t) => t.id)) : new Set())} /> Todo el equipo ({team.length})
          </label>
          <ul className="max-h-[360px] divide-y overflow-y-auto">
            {team.map((w) => (
              <li key={w.id}>
                <label className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Checkbox checked={selected.has(w.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(w.id); else n.delete(w.id); return n; })} />
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {!w.email && <span className="text-[11px] text-muted-foreground">sin correo</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
