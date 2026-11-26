"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CalendarPlus, Copy, FileUp, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Sheet } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { formatDate } from "@/lib/utils";
import { addTask, deleteFile, deleteTask, duplicateProject, toggleTask, updateProject } from "@/server/actions/projects";
import { generateShifts } from "@/server/actions/crew";
import { fromLocalInput } from "../../pedidos/[id]/header-sheet";

type ProjectInfo = { id: string; name: string; startsAt: string | null; clientId: string | null; venueId: string | null; description: string | null; color: string | null; orders: number };
type Opt = { id: string; name: string };

export function ProjectActions({ project, clients, venues }: { project: ProjectInfo; clients: Opt[]; venues: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, start] = useTransition();
  const nextYear = project.startsAt ? new Date(new Date(project.startsAt).getTime() + 365 * 86_400_000).toISOString().slice(0, 16) : "";
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Editar</Button>
      <EditProjectSheet open={editOpen} onOpenChange={setEditOpen} project={project} clients={clients} venues={venues} />
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!project.startsAt}><Copy /> Duplicar (recurrente)</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Duplicar proyecto</DialogTitle>
            <DialogDescription>Copia fases y pedidos (como borradores) desplazados a la nueva fecha. Útil para eventos que se repiten cada año.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const r = await duplicateProject({ id: project.id, name: String(f.get("name")), newStart: fromLocalInput(String(f.get("start"))) });
                if (!r.ok) { toast.error(r.error); return; }
                router.push(`/app/proyectos/${r.data.id}`);
              });
            }}
          >
            <Field label="Nombre" htmlFor="dp-n"><Input id="dp-n" name="name" defaultValue={`${project.name} ${new Date().getFullYear() + 1}`} /></Field>
            <Field label="Nueva fecha de inicio (carga)" htmlFor="dp-s"><Input id="dp-s" name="start" type="datetime-local" defaultValue={nextYear} /></Field>
            <DialogFooter><Button disabled={pending}>Duplicar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditProjectSheet({ open, onOpenChange, project, clients, venues }: { open: boolean; onOpenChange: (o: boolean) => void; project: ProjectInfo; clients: Opt[]; venues: Opt[] }) {
  const router = useRouter();
  const [v, setV] = useState({ name: project.name, clientId: project.clientId ?? "", venueId: project.venueId ?? "", description: project.description ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Editar proyecto" description="Las fechas del proyecto salen de sus pedidos y fases.">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateProject({ id: project.id, name: v.name, clientId: v.clientId || null, venueId: v.venueId || null, description: v.description.trim() || null, color: project.color });
            if (!r.ok) {
              setErrors(r.fieldErrors ?? {});
              toast.error(r.error);
              return;
            }
            toast.success("Proyecto actualizado");
            onOpenChange(false);
            router.refresh();
          });
        }}
      >
        <Field label="Nombre" htmlFor="ep-name" error={errors.name}><Input id="ep-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Cliente" htmlFor="ep-client" hint={project.orders ? "Los pedidos abiertos que tenían el cliente anterior (o ninguno) pasan al nuevo" : undefined}>
          <NativeSelect id="ep-client" value={v.clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })}>
            <option value="">Sin cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Lugar" htmlFor="ep-venue" hint={project.orders ? "Lo comparten todos los pedidos del proyecto. Al cambiarlo se vuelve a calcular la distancia" : undefined}>
          <NativeSelect id="ep-venue" value={v.venueId} onChange={(e) => setV({ ...v, venueId: e.target.value })}>
            <option value="">Sin lugar</option>
            {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Descripción" htmlFor="ep-d"><Textarea id="ep-d" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Sheet>
  );
}

export function GenerateShiftsButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateShifts({ projectId });
          if (!r.ok) { toast.error(r.error); return; }
          const created = (r.data as { created?: string[] }).created?.length ?? 0;
          toast.success(created ? `${created} turnos generados desde el despiece` : "Los turnos ya estaban generados");
          router.refresh();
        })
      }
    >
      <Users /> Generar turnos
    </Button>
  );
}

export function TasksPanel({ projectId, tasks, canEdit }: { projectId: string; tasks: { id: string; title: string; done: boolean; dueAt: string | null }[]; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="group flex items-center gap-2 text-sm">
            <Checkbox checked={t.done} aria-label={t.title} disabled={!canEdit} onCheckedChange={(v) => start(async () => { await toggleTask({ id: t.id, done: v === true }); router.refresh(); })} />
            <span className={`flex-1 ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.title}</span>
            {t.dueAt && <span className={`text-xs ${!t.done && new Date(t.dueAt) < new Date() ? "text-danger" : "text-muted-foreground"}`}>{formatDate(t.dueAt, { day: "numeric", month: "short" })}</span>}
            {canEdit && <button aria-label="Eliminar tarea" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => start(async () => { await deleteTask({ id: t.id }); router.refresh(); })}><Trash2 className="size-3.5 text-muted-foreground" /></button>}
          </li>
        ))}
        {tasks.length === 0 && <li className="text-sm text-muted-foreground">Sin tareas.</li>}
      </ul>
      {canEdit && <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          start(async () => {
            await addTask({ projectId, title, dueAt: due ? fromLocalInput(`${due}T12:00`) : null });
            setTitle("");
            setDue("");
            router.refresh();
          });
        }}
      >
        <Input aria-label="Nueva tarea" placeholder="Nueva tarea…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input aria-label="Fecha límite" type="date" className="w-36" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button size="icon" variant="outline" aria-label="Añadir tarea"><CalendarPlus /></Button>
      </form>}
    </div>
  );
}

export function FilesPanel({ projectId, files, canEdit }: { projectId: string; files: { id: string; name: string; size: number; url: string; createdAt: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  return (
    <div className="space-y-3">
      <ul className="divide-y text-sm">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-2">
            <a href={f.url} target="_blank" rel="noreferrer" className="truncate hover:underline">{f.name}</a>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              {Math.round(f.size / 1024)} KB · {f.createdAt}
              {canEdit && <button aria-label={`Eliminar ${f.name}`} onClick={() => start(async () => { await deleteFile({ id: f.id }); router.refresh(); })}><Trash2 className="size-3.5" /></button>}
            </span>
          </li>
        ))}
        {files.length === 0 && <li className="py-2 text-sm text-muted-foreground">Sin archivos: planos, permisos, fotos…</li>}
      </ul>
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 15 * 1024 * 1024) { toast.error("Máximo 15 MB"); return; }
              setBusy(true);
              const fd = new FormData();
              fd.append("file", file);
              const res = await fetch(`/app/proyectos/${projectId}/archivos`, { method: "POST", body: fd });
              setBusy(false);
              if (!res.ok) toast.error("No se pudo subir el archivo");
              router.refresh();
            }}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}><FileUp /> {busy ? "Subiendo…" : "Subir archivo"}</Button>
        </>
      )}
    </div>
  );
}
