"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { createOrder } from "@/server/actions/orders";
import { fromLocalInput } from "../[id]/header-sheet";

type Opt = { id: string; name: string };

export function NewOrderForm({ clients, venues, templates, projects, families, templateId, projectId }: { clients: Opt[]; venues: Opt[]; templates: Opt[]; projects: (Opt & { number: string })[]; families: Opt[]; templateId: string | null; projectId: string | null }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({
    title: "",
    clientId: "",
    newClientName: "",
    venueId: "",
    projectId: projectId ?? "",
    loadAt: `${addDays(today, 7)}T08:00`,
    eventStart: `${addDays(today, 8)}T12:00`,
    eventEnd: `${addDays(today, 9)}T02:00`,
    returnAt: `${addDays(today, 10)}T18:00`,
    start: templateId ? `t:${templateId}` : families[0] ? `f:${families[0].id}` : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <Card>
      <CardContent className="pt-5">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createOrder({
                title: v.title,
                clientId: v.clientId && v.clientId !== "__new" ? v.clientId : null,
                newClientName: v.clientId === "__new" ? v.newClientName : null,
                venueId: v.venueId || null,
                projectId: v.projectId || null,
                loadAt: fromLocalInput(v.loadAt),
                eventStart: fromLocalInput(v.eventStart),
                eventEnd: fromLocalInput(v.eventEnd),
                returnAt: fromLocalInput(v.returnAt),
                templateId: v.start.startsWith("t:") ? v.start.slice(2) : null,
                familyId: v.start.startsWith("f:") ? v.start.slice(2) : null,
              });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                toast.error(r.error);
                return;
              }
              router.push(`/app/pedidos/${r.data.id}`);
            });
          }}
        >
          <Field label="Título del evento" htmlFor="n-title" error={errors.title} className="sm:col-span-2">
            <Input id="n-title" placeholder="Boda en finca, feria de muestras…" value={v.title} onChange={set("title")} autoFocus />
          </Field>
          <Field label="Cliente" htmlFor="n-client">
            <NativeSelect id="n-client" value={v.clientId} onChange={set("clientId")}>
              <option value="">Sin cliente todavía</option>
              <option value="__new">+ Nuevo cliente…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </Field>
          {v.clientId === "__new" ? (
            <Field label="Nombre del nuevo cliente" htmlFor="n-newc"><Input id="n-newc" value={v.newClientName} onChange={set("newClientName")} /></Field>
          ) : (
            <Field label="Lugar" htmlFor="n-venue">
              <NativeSelect id="n-venue" value={v.venueId} onChange={set("venueId")}>
                <option value="">Sin lugar</option>
                {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="Proyecto" htmlFor="n-proj" hint="Si lo dejas vacío se crea uno nuevo">
            <NativeSelect id="n-proj" value={v.projectId} onChange={set("projectId")}>
              <option value="">Nuevo proyecto</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Empezar con" htmlFor="n-start">
            <NativeSelect id="n-start" value={v.start} onChange={set("start")}>
              <option value="">Pedido vacío</option>
              <optgroup label="Carpa">{families.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.name}</option>)}</optgroup>
              {templates.length > 0 && <optgroup label="Plantilla">{templates.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}</optgroup>}
            </NativeSelect>
          </Field>
          <Field label="Carga" htmlFor="n-load"><Input id="n-load" type="datetime-local" value={v.loadAt} onChange={set("loadAt")} /></Field>
          <Field label="Retorno" htmlFor="n-ret" error={errors.returnAt}><Input id="n-ret" type="datetime-local" value={v.returnAt} onChange={set("returnAt")} /></Field>
          <Field label="Inicio del evento" htmlFor="n-es"><Input id="n-es" type="datetime-local" value={v.eventStart} onChange={set("eventStart")} /></Field>
          <Field label="Fin del evento" htmlFor="n-ee"><Input id="n-ee" type="datetime-local" value={v.eventEnd} onChange={set("eventEnd")} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button disabled={pending}>{pending ? "Creando…" : "Crear pedido"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
