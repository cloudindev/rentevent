"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { deleteCompany, eraseContact } from "@/server/actions/settings";

export function AuditFilters({ entities, actions, current }: { entities: string[]; actions: string[]; current: Record<string, string> }) {
  const router = useRouter();
  const [v, setV] = useState(current);
  const apply = (next: Record<string, string>) => {
    setV(next);
    const q = new URLSearchParams(Object.entries(next).filter(([, x]) => x));
    router.push(`/app/configuracion/seguridad?${q.toString()}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <NativeSelect aria-label="Entidad" className="w-44" value={v.entidad} onChange={(e) => apply({ ...v, entidad: e.target.value })}>
        <option value="">Todas las entidades</option>
        {entities.map((e) => <option key={e} value={e}>{e}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Acción" className="w-40" value={v.accion} onChange={(e) => apply({ ...v, accion: e.target.value })}>
        <option value="">Todas las acciones</option>
        {actions.map((a) => <option key={a} value={a}>{a}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Periodo" className="w-36" value={v.dias} onChange={(e) => apply({ ...v, dias: e.target.value })}>
        {["1", "7", "30", "90", "365"].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
      </NativeSelect>
      <Input aria-label="Usuario" placeholder="Usuario…" className="w-44" value={v.usuario} onChange={(e) => setV({ ...v, usuario: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply(v)} />
    </div>
  );
}

export function ContactRgpd({ contacts }: { contacts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [id, setId] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="rounded-lg border p-3">
      <p className="font-medium">Derechos de un contacto</p>
      <p className="mb-3 text-muted-foreground">Acceso (descarga de sus datos) y supresión. Si tiene facturas, se anonimiza y se conservan las facturas por obligación legal.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Contacto" htmlFor="rg-c" className="min-w-64 flex-1">
          <NativeSelect id="rg-c" value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Elige un contacto…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Button asChild variant="outline" disabled={!id}><a href={id ? `/app/configuracion/datos/contacto?id=${id}` : undefined} aria-disabled={!id}>Descargar sus datos</a></Button>
        <Button
          variant="danger"
          disabled={!id || pending}
          onClick={() =>
            confirm("¿Suprimir los datos personales de este contacto? No se puede deshacer.") &&
            start(async () => {
              const r = await eraseContact({ contactId: id });
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success(r.data.mode === "anonimizado" ? "Contacto anonimizado (facturas conservadas)" : "Contacto eliminado");
              setId("");
              router.refresh();
            })
          }
        >
          Suprimir
        </Button>
      </div>
    </div>
  );
}

export function DangerZone({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card className="border-danger/40">
      <CardHeader>
        <div>
          <CardTitle className="text-danger">Eliminar la empresa</CardTitle>
          <CardDescription>Borra {name} y todos sus datos de forma permanente. Descarga antes la exportación.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <Field label={`Escribe «${slug}» para confirmar`} htmlFor="del-slug" className="min-w-64 flex-1">
          <Input id="del-slug" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </Field>
        <Button
          variant="danger"
          disabled={confirmText !== slug || pending}
          onClick={() =>
            start(async () => {
              const r = await deleteCompany({ confirmSlug: confirmText });
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              router.push("/espacios");
              router.refresh();
            })
          }
        >
          Eliminar definitivamente
        </Button>
      </CardContent>
    </Card>
  );
}
