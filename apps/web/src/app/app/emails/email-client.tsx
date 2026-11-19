"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link2, MailOpen, PenSquare, Plus, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import { deleteEmailTemplate, linkEmail, markEmailRead, saveEmailTemplate, sendEmailMessage } from "@/server/actions/comms";

type Template = { id: string; key: string; name: string; subject: string; body: string };
type Opt = { id: string; label: string; email?: string | null };
type Entities = { orders: Opt[]; projects: Opt[]; contacts: Opt[] };
type EntityKind = "order" | "project" | "contact";

function EntityPicker({ entities, entity, entityId, onChange }: { entities: Entities; entity: EntityKind | null; entityId: string | null; onChange: (e: EntityKind | null, id: string | null) => void }) {
  const list = entity === "order" ? entities.orders : entity === "project" ? entities.projects : entity === "contact" ? entities.contacts : [];
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <NativeSelect aria-label="Tipo de registro" value={entity ?? ""} onChange={(e) => onChange((e.target.value || null) as EntityKind | null, null)}>
        <option value="">Sin vincular</option>
        <option value="order">Pedido</option>
        <option value="project">Proyecto</option>
        <option value="contact">Contacto</option>
      </NativeSelect>
      <NativeSelect aria-label="Registro" value={entityId ?? ""} disabled={!entity} onChange={(e) => onChange(entity, e.target.value || null)}>
        <option value="">Elige…</option>
        {list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}

function ComposeDialog({ open, onOpenChange, initial, templates, entities, replyToId }: { open: boolean; onOpenChange: (o: boolean) => void; initial: { to: string; subject: string; body: string; entity: EntityKind | null; entityId: string | null }; templates: Template[]; entities: Entities; replyToId: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{replyToId ? "Responder" : "Nuevo correo"}</DialogTitle>
          <DialogDescription>Se envía con el remitente de la empresa y queda guardado en la bandeja compartida.</DialogDescription>
        </DialogHeader>
        {templates.length > 0 && (
          <Field label="Plantilla" htmlFor="c-tpl" hint="Rellena asunto y cuerpo; revisa las variables {{…}} antes de enviar">
            <NativeSelect id="c-tpl" defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setV({ ...v, subject: t.subject, body: t.body }); }}>
              <option value="">Sin plantilla</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </NativeSelect>
          </Field>
        )}
        <Field label="Para" htmlFor="c-to" error={errors.to}>
          <Input id="c-to" type="email" list="c-contacts" value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} />
          <datalist id="c-contacts">{entities.contacts.filter((c) => c.email).map((c) => <option key={c.id} value={c.email!}>{c.label}</option>)}</datalist>
        </Field>
        <Field label="Asunto" htmlFor="c-subject" error={errors.subject}><Input id="c-subject" value={v.subject} onChange={(e) => setV({ ...v, subject: e.target.value })} /></Field>
        <Field label="Mensaje" htmlFor="c-body" error={errors.body}><Textarea id="c-body" rows={8} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} /></Field>
        <Field label="Vincular a" htmlFor="c-ent"><EntityPicker entities={entities} entity={v.entity} entityId={v.entityId} onChange={(entity, entityId) => setV({ ...v, entity, entityId })} /></Field>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await sendEmailMessage({ ...v, entityId: v.entity ? v.entityId : null, replyToId });
                if (!r.ok) {
                  setErrors(r.fieldErrors ?? {});
                  toast.error(r.error);
                  return;
                }
                toast.success(r.data.mode === "real" ? "Correo enviado" : "Correo enviado (modo simulado)");
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Compose({ templates, entities }: { templates: Template[]; entities: Entities }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><PenSquare /> Redactar</Button>
      {open && <ComposeDialog open={open} onOpenChange={setOpen} initial={{ to: "", subject: "", body: "", entity: null, entityId: null }} templates={templates} entities={entities} replyToId={null} />}
    </>
  );
}

export function EmailActions({ email, entities, templates, canEdit }: { email: { id: string; direction: string; from: string; to: string; subject: string; entity: string | null; entityId: string | null }; entities: Entities; templates: Template[]; canEdit: boolean }) {
  const router = useRouter();
  const [reply, setReply] = useState(false);
  const [linking, setLinking] = useState(false);
  const [ent, setEnt] = useState<{ entity: EntityKind | null; entityId: string | null }>({ entity: email.entity as EntityKind | null, entityId: email.entityId });
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && <Button size="sm" onClick={() => setReply(true)}><Reply /> Responder</Button>}
      {canEdit && <Button size="sm" variant="outline" onClick={() => setLinking(true)}><Link2 /> Vincular</Button>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await markEmailRead({ id: email.id, read: false }); router.push("/app/emails"); router.refresh(); })}><MailOpen /> Marcar como no leído</Button>
      {reply && (
        <ComposeDialog
          open={reply}
          onOpenChange={setReply}
          replyToId={email.id}
          templates={templates}
          entities={entities}
          initial={{ to: email.direction === "entrante" ? email.from : email.to, subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`, body: "", entity: email.entity as EntityKind | null, entityId: email.entityId }}
        />
      )}
      <Dialog open={linking} onOpenChange={setLinking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular correo</DialogTitle>
            <DialogDescription>El correo aparecerá en el historial del registro elegido.</DialogDescription>
          </DialogHeader>
          <EntityPicker entities={entities} entity={ent.entity} entityId={ent.entityId} onChange={(entity, entityId) => setEnt({ entity, entityId })} />
          <DialogFooter>
            <Button
              disabled={pending || (ent.entity !== null && !ent.entityId)}
              onClick={() =>
                start(async () => {
                  const r = await linkEmail({ id: email.id, entity: ent.entity, entityId: ent.entity ? ent.entityId : null });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setLinking(false);
                  router.refresh();
                })
              }
            >
              {ent.entity ? "Vincular" : "Quitar vínculo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TemplatesManager({ templates, canEdit }: { templates: Template[]; canEdit: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<(Omit<Template, "id"> & { id: string | null }) | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Plantillas de correo</h2>
          <p className="text-sm text-muted-foreground">Variables: {"{{cliente}} {{pedido}} {{evento}} {{montaje}} {{retorno}} {{empresa}} {{enlace}}"}</p>
        </div>
        {canEdit && <Button size="sm" onClick={() => { setErrors({}); setEdit({ id: null, key: "", name: "", subject: "", body: "" }); }}><Plus /> Nueva plantilla</Button>}
      </div>
      {templates.length === 0 ? (
        <EmptyState icon={PenSquare} title="Sin plantillas" description="Crea plantillas para presupuestos, confirmaciones o recordatorios." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{t.key}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setErrors({}); setEdit(t); }}>Editar</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${t.name}`} onClick={() => confirm("¿Eliminar la plantilla? Los workflows que la usen dejarán de enviarla.") && start(async () => { await deleteEmailTemplate({ id: t.id }); router.refresh(); })}><Trash2 /></Button>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-sm">{t.subject}</p>
              <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" htmlFor="t-name" error={errors.name}><Input id="t-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Clave" htmlFor="t-key" error={errors.key} hint="La usan los workflows"><Input id="t-key" value={edit.key} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, key: e.target.value })} /></Field>
              <Field label="Asunto" htmlFor="t-subject" error={errors.subject} className="sm:col-span-2"><Input id="t-subject" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></Field>
              <Field label="Cuerpo" htmlFor="t-body" error={errors.body} className="sm:col-span-2"><Textarea id="t-body" rows={10} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveEmailTemplate(edit!);
                  if (!r.ok) {
                    setErrors(r.fieldErrors ?? {});
                    toast.error(r.error);
                    return;
                  }
                  setEdit(null);
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
