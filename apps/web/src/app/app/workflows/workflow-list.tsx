"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play, Plus, Trash2, Workflow as WorkflowIcon, Zap, Filter, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { formatDateTime } from "@/lib/utils";
import { CONDITION_FIELDS, CONDITION_OPS, TEMPLATE_VARIABLES, type Condition } from "@/server/workflows/logic";
import { deleteWorkflow, runWorkflowNow, saveWorkflow, toggleWorkflow } from "@/server/actions/workflows";

type Channel = "push" | "email" | "whatsapp" | "interno";
type Action =
  | { type: "caducar_opciones" }
  | { type: "avisar_escasez"; channel: Channel; to: string }
  | { type: "enviar_plantilla"; template: string; to?: string }
  | { type: "publicar_planning"; channel: Channel }
  | { type: "notificar"; channel: Channel; to: string; title: string; body: string };
type Wf = { id: string | null; name: string; trigger: string; conditions: Condition[]; action: Action; active: boolean; lastRunAt?: string | null };
type Run = { id: string; workflowId: string; status: string; detail: string | null; entityId: string | null; createdAt: string };

const CHANNELS: Record<Channel, string> = { push: "Push", email: "Correo", whatsapp: "WhatsApp", interno: "Interno" };
const RUN_TONE = { ok: "success", omitido: "neutral", error: "danger" } as const;

function defaultAction(type: Action["type"]): Action {
  switch (type) {
    case "caducar_opciones":
      return { type };
    case "avisar_escasez":
      return { type, channel: "email", to: "" };
    case "enviar_plantilla":
      return { type, template: "" };
    case "publicar_planning":
      return { type, channel: "push" };
    case "notificar":
      return { type, channel: "interno", to: "", title: "", body: "" };
  }
}

function describe(w: Wf, triggers: Record<string, string>, actions: Record<string, string>) {
  const cond = w.conditions.length ? ` si ${w.conditions.map((c) => `${CONDITION_FIELDS[c.field] ?? c.field} ${c.op} ${c.value}`).join(" y ")}` : "";
  return `${triggers[w.trigger] ?? w.trigger}${cond} → ${actions[w.action.type] ?? w.action.type}`;
}

export function WorkflowList({ workflows, runs, templates, canEdit, triggers, actions }: { workflows: Wf[]; runs: Run[]; templates: { key: string; name: string }[]; canEdit: boolean; triggers: Record<string, string>; actions: Record<string, string> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Wf | null>(null);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const name = new Map(workflows.map((w) => [w.id, w.name]));

  const save = () =>
    start(async () => {
      if (!editing) return;
      const r = await saveWorkflow({ ...editing, trigger: editing.trigger as "diario" });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
        return;
      }
      toast.success("Workflow guardado");
      setEditing(null);
      router.refresh();
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Automatizaciones</h2>
          {canEdit && (
            <Button size="sm" onClick={() => { setErrors({}); setEditing({ id: null, name: "", trigger: "pedido_confirmado", conditions: [], action: defaultAction("notificar"), active: true }); }}>
              <Plus /> Nuevo workflow
            </Button>
          )}
        </div>
        {workflows.length === 0 ? (
          <EmptyState icon={WorkflowIcon} title="Sin workflows" description="Automatiza avisos de escasez, recordatorios de devolución, caducidad de opciones o la publicación del planning." />
        ) : (
          <ul className="space-y-2">
            {workflows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
                <Switch aria-label={w.active ? "Desactivar" : "Activar"} checked={w.active} disabled={!canEdit} onCheckedChange={(v) => start(async () => { await toggleWorkflow({ id: w.id!, active: v }); router.refresh(); })} />
                <button className="min-w-0 flex-1 text-left" onClick={() => canEdit && (setErrors({}), setEditing(w))} disabled={!canEdit}>
                  <p className="font-medium">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{describe(w, triggers, actions)}</p>
                </button>
                <span className="text-xs text-muted-foreground">{w.lastRunAt ? `Última: ${formatDateTime(w.lastRunAt)}` : "Nunca ejecutado"}</span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await runWorkflowNow(w.id!);
                        if (r.ok) toast.success(r.summary);
                        else toast.error(r.error);
                        router.refresh();
                      })
                    }
                  >
                    <Play /> Ejecutar ahora
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Registro de ejecuciones</h2>
        {runs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Todavía no se ha ejecutado ningún workflow.</p>
        ) : (
          <ul className="max-h-[640px] divide-y overflow-y-auto text-sm">
            {runs.map((r) => (
              <li key={r.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{name.get(r.workflowId) ?? "Workflow eliminado"}</span>
                  <StatusPill tone={RUN_TONE[r.status as keyof typeof RUN_TONE] ?? "neutral"}>{r.status}</StatusPill>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.createdAt)} · {r.detail}
                  {r.entityId && (
                    <>
                      {" · "}
                      <Link className="text-link hover:underline" href={`/app/pedidos/${r.entityId}`}>ver pedido</Link>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? "Editar workflow" : "Nuevo workflow"} description="Cuando ocurre el disparador y se cumplen las condiciones, se ejecuta la acción." className="max-w-lg">
        {editing && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Nombre" htmlFor="wf-name" error={errors.name}>
              <Input id="wf-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <div className="space-y-2 rounded-xl border p-3">
              <p className="flex items-center gap-2 text-[13px] font-medium"><Zap className="size-4 text-brand-600" /> Disparador</p>
              <NativeSelect aria-label="Disparador" value={editing.trigger} onChange={(e) => setEditing({ ...editing, trigger: e.target.value })}>
                {Object.entries(triggers).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2 rounded-xl border p-3">
              <p className="flex items-center gap-2 text-[13px] font-medium"><Filter className="size-4 text-muted-foreground" /> Condiciones <span className="font-normal text-muted-foreground">(todas deben cumplirse)</span></p>
              {editing.conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_96px_1fr_32px] gap-1.5">
                  <NativeSelect aria-label="Campo" value={c.field} onChange={(e) => setEditing({ ...editing, conditions: editing.conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })}>
                    {Object.entries(CONDITION_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect>
                  <NativeSelect aria-label="Operador" value={c.op} onChange={(e) => setEditing({ ...editing, conditions: editing.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as Condition["op"] } : x)) })}>
                    {CONDITION_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </NativeSelect>
                  <Input aria-label="Valor" value={String(c.value)} onChange={(e) => setEditing({ ...editing, conditions: editing.conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar condición" onClick={() => setEditing({ ...editing, conditions: editing.conditions.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ ...editing, conditions: [...editing.conditions, { field: "total", op: ">", value: "5000" }] })}><Plus /> Condición</Button>
            </div>
            <div className="space-y-3 rounded-xl border p-3">
              <p className="flex items-center gap-2 text-[13px] font-medium"><ArrowRight className="size-4 text-muted-foreground" /> Acción</p>
              <NativeSelect aria-label="Acción" value={editing.action.type} onChange={(e) => setEditing({ ...editing, action: defaultAction(e.target.value as Action["type"]) })}>
                {Object.entries(actions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
              {"channel" in editing.action && (
                <Field label="Canal" htmlFor="wf-ch">
                  <NativeSelect id="wf-ch" value={editing.action.channel} onChange={(e) => setEditing({ ...editing, action: { ...editing.action, channel: e.target.value as Channel } as Action })}>
                    {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect>
                </Field>
              )}
              {(editing.action.type === "avisar_escasez" || editing.action.type === "notificar") && (
                <Field label="Destinatario" htmlFor="wf-to" hint="Correo, teléfono o nombre; admite variables como {{cliente}}" error={errors["action.to"]}>
                  <Input id="wf-to" value={editing.action.to} onChange={(e) => setEditing({ ...editing, action: { ...editing.action, to: e.target.value } as Action })} />
                </Field>
              )}
              {editing.action.type === "enviar_plantilla" && (
                <>
                  <Field label="Plantilla" htmlFor="wf-tpl" error={errors["action.template"]}>
                    <NativeSelect id="wf-tpl" value={editing.action.template} onChange={(e) => setEditing({ ...editing, action: { ...editing.action, template: e.target.value } as Action })}>
                      <option value="">Elige…</option>
                      {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Destinatario" htmlFor="wf-tpl-to" hint="Vacío = correo del cliente del pedido">
                    <Input id="wf-tpl-to" value={editing.action.to ?? ""} onChange={(e) => setEditing({ ...editing, action: { ...editing.action, to: e.target.value || undefined } as Action })} />
                  </Field>
                </>
              )}
              {editing.action.type === "notificar" && (
                <>
                  <Field label="Título" htmlFor="wf-title"><Input id="wf-title" value={editing.action.title} onChange={(e) => setEditing({ ...editing, action: { ...editing.action, title: e.target.value } as Action })} /></Field>
                  <Field label="Mensaje" htmlFor="wf-body"><Textarea id="wf-body" value={editing.action.body} onChange={(e) => setEditing({ ...editing, action: { ...editing.action, body: e.target.value } as Action })} /></Field>
                </>
              )}
              <p className="text-xs text-muted-foreground">Variables: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(" ")}</p>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> Activo</label>
            <div className="flex justify-between gap-2">
              {editing.id ? (
                <Button type="button" variant="ghost" className="text-danger" onClick={() => confirm("¿Eliminar este workflow?") && start(async () => { await deleteWorkflow({ id: editing.id! }); setEditing(null); router.refresh(); })}>
                  <Trash2 /> Eliminar
                </Button>
              ) : <span />}
              <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
