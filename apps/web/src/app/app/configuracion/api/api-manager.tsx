"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, KeyRound, Plus, RotateCw, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/menu";
import { formatDateTime } from "@/lib/utils";
import { createApiKey, deleteWebhook, retryWebhookDelivery, revokeApiKey, saveWebhook, testWebhook } from "@/server/actions/settings";

type Key = { id: string; name: string; prefix: string; createdBy: string | null; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
type Hook = { id: string; url: string; events: string[]; active: boolean };
type Delivery = { id: string; webhookId: string; event: string; status: number | null; attempts: number; error: string | null; createdAt: string; delivered: boolean };

export function ApiManager({ baseUrl, events, keys, hooks, deliveries }: { baseUrl: string; events: string[]; keys: Key[]; hooks: Hook[]; deliveries: Delivery[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [keyName, setKeyName] = useState("");
  const [secret, setSecret] = useState<{ title: string; value: string; note: string } | null>(null);
  const [hook, setHook] = useState<{ id: string | null; url: string; events: string[]; active: boolean } | null>(null);
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success("Copiado"));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Claves de API</CardTitle>
            <CardDescription>
              Base: <code className="rounded bg-muted px-1">{baseUrl}</code> · Especificación: <a className="text-link underline" href="/api/v1/openapi.json" target="_blank" rel="noreferrer">openapi.json</a>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await createApiKey({ name: keyName });
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                setSecret({ title: "Clave creada", value: r.data.secret, note: "Cópiala ahora: no volverá a mostrarse. Úsala como Authorization: Bearer …" });
                setKeyName("");
                router.refresh();
              });
            }}
          >
            <Field label="Nombre de la clave" htmlFor="k-name" className="min-w-64 flex-1"><Input id="k-name" placeholder="ERP, web, Zapier…" value={keyName} onChange={(e) => setKeyName(e.target.value)} /></Field>
            <Button disabled={pending || keyName.trim().length < 2}><KeyRound /> Crear clave</Button>
          </form>
          <ul className="divide-y rounded-lg border text-sm">
            {keys.length === 0 && <li className="px-3 py-4 text-muted-foreground">Aún no hay claves.</li>}
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="flex-1">
                  <span className="font-medium">{k.name}</span> <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                  <span className="block text-xs text-muted-foreground">Creada {formatDateTime(k.createdAt)}{k.createdBy ? ` por ${k.createdBy}` : ""} · {k.lastUsedAt ? `último uso ${formatDateTime(k.lastUsedAt)}` : "sin uso"}</span>
                </span>
                {k.revokedAt ? <StatusPill tone="danger">Revocada</StatusPill> : (
                  <>
                    <StatusPill tone="success">Activa</StatusPill>
                    <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => confirm(`¿Revocar la clave ${k.name}? Las integraciones que la usen dejarán de funcionar.`) && start(async () => { await revokeApiKey({ id: k.id }); router.refresh(); })}>Revocar</Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Enviamos un POST JSON firmado con HMAC-SHA256 en la cabecera X-Rentevent-Signature (t=marca,v1=firma).</CardDescription>
          </div>
          <Button size="sm" onClick={() => setHook({ id: null, url: "https://", events: ["order.confirmed"], active: true })}><Plus /> Webhook</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {hooks.length === 0 && <p className="text-sm text-muted-foreground">Sin webhooks.</p>}
          {hooks.map((h) => (
            <div key={h.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
              <Webhook className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.url}</span>
                <span className="block text-xs text-muted-foreground">{h.events.join(", ")}</span>
              </span>
              <StatusPill tone={h.active ? "success" : "neutral"}>{h.active ? "Activo" : "Pausado"}</StatusPill>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await testWebhook({ id: h.id }); if (r.ok) toast[r.data.ok ? "success" : "error"](r.data.ok ? "Entrega correcta" : "La URL no respondió con 2xx"); router.refresh(); })}><Send /> Probar</Button>
              <Button size="sm" variant="ghost" onClick={() => setHook(h)}>Editar</Button>
              <Button size="icon-sm" variant="ghost" aria-label="Eliminar webhook" disabled={pending} onClick={() => confirm("¿Eliminar el webhook?") && start(async () => { await deleteWebhook({ id: h.id }); router.refresh(); })}><Trash2 /></Button>
            </div>
          ))}
          {deliveries.length > 0 && (
            <details className="pt-2 text-sm" open>
              <summary className="cursor-pointer font-medium">Últimas entregas</summary>
              <ul className="mt-2 divide-y rounded-lg border">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
                    <code>{d.event}</code>
                    <span className="flex-1 text-muted-foreground">{formatDateTime(d.createdAt)} · {d.attempts} intento{d.attempts > 1 ? "s" : ""}{d.error ? ` · ${d.error}` : ""}</span>
                    <StatusPill tone={d.delivered ? "success" : "danger"}>{d.status ?? "sin respuesta"}</StatusPill>
                    {!d.delivered && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await retryWebhookDelivery({ id: d.id }); router.refresh(); })}><RotateCw /> Reintentar</Button>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!hook} onOpenChange={(o) => !o && setHook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hook?.id ? "Editar webhook" : "Nuevo webhook"}</DialogTitle>
            <DialogDescription>Elige los eventos que quieres recibir.</DialogDescription>
          </DialogHeader>
          {hook && (
            <div className="space-y-4">
              <Field label="URL" htmlFor="h-url"><Input id="h-url" value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {["*", ...events].map((ev) => (
                  <label key={ev} className="flex items-center gap-2">
                    <Checkbox checked={hook.events.includes(ev)} onCheckedChange={(v) => setHook({ ...hook, events: v ? [...hook.events, ev] : hook.events.filter((x) => x !== ev) })} />
                    <code className="text-xs">{ev === "*" ? "* (todos)" : ev}</code>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={hook.active} onCheckedChange={(v) => setHook({ ...hook, active: v })} /> Activo</label>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveWebhook({ id: hook!.id, url: hook!.url, events: hook!.events as never, active: hook!.active });
                  if (!r.ok) {
                    toast.error(r.fieldErrors ? Object.values(r.fieldErrors)[0] : r.error);
                    return;
                  }
                  setHook(null);
                  if (r.data.secret) setSecret({ title: "Secreto de firma", value: r.data.secret, note: "Guárdalo para verificar la firma X-Rentevent-Signature. No volverá a mostrarse." });
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{secret?.title}</DialogTitle>
            <DialogDescription>{secret?.note}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={secret?.value ?? ""} className="font-mono text-xs" aria-label="Secreto" onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" aria-label="Copiar" onClick={() => secret && copy(secret.value)}><Copy /></Button>
          </div>
          <DialogFooter><Button onClick={() => setSecret(null)}>Hecho</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
