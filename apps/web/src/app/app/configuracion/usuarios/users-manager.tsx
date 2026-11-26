"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { Check, Mail, RotateCw, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { ROLES, type Role } from "@rentevent/db/schema";
import { canSeeField, PERMISSION_LABELS, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, initials } from "@/lib/utils";
import { changeRole, inviteUser, removeMember, resendInvitation, revokeInvitation } from "@/server/actions/users";
import { saveFieldPermissions } from "@/server/actions/settings";

type M = { id: string; userId: string; role: string; createdAt: string; name: string; email: string };
type I = { id: string; email: string; role: string; expiresAt: string; expired: boolean };
const FIELDS = [
  { key: "margen", label: "Margen" },
  { key: "coste", label: "Costes" },
  { key: "coste_hora", label: "Coste/hora personal" },
] as const;

export function UsersManager({
  me,
  members,
  invitations,
  fieldPermissions,
  seats,
}: {
  me: string;
  members: M[];
  invitations: I[];
  fieldPermissions: Record<string, Record<string, boolean>>;
  /** Seats of the paid plan (members + live invitations); null during the trial or without a plan. */
  seats: { used: number; limit: number } | null;
}) {
  const full = seats != null && seats.used >= seats.limit;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("comercial");
  const [fp, setFp] = useState(fieldPermissions);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "Error");
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Invitar a una persona</CardTitle>
            <CardDescription>
              Recibirá un correo con un enlace válido 7 días.
              {seats && ` Plazas: ${seats.used} de ${seats.limit} (usuarios e invitaciones pendientes).`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await inviteUser({ email, role });
                if (!r.ok) {
                  toast.error(r.fieldErrors?.email ?? r.error);
                  return;
                }
                toast.success(`Invitación enviada a ${email}`);
                setEmail("");
                router.refresh();
              });
            }}
          >
            <Field label="Correo" htmlFor="inv-email" className="min-w-64 flex-1"><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Rol" htmlFor="inv-role">
              <NativeSelect id="inv-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </NativeSelect>
            </Field>
            <Button disabled={pending || !email || full}><UserPlus /> Invitar</Button>
          </form>
          {full && (
            <p className="mt-3 text-sm text-muted-foreground">
              Has ocupado todas las plazas de tu plan. <Link className="text-link hover:underline" href="/app/configuracion/suscripcion">Amplía la suscripción</Link> o anula una invitación pendiente para invitar a otra persona.
            </p>
          )}
          {invitations.length > 0 && (
            <ul className="mt-4 divide-y rounded-lg border text-sm">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="flex-1">{i.email} <span className="text-muted-foreground">· {ROLE_LABELS[i.role as Role] ?? i.role} · {i.expired ? "caducó" : "caduca"} {formatDate(i.expiresAt)}</span></span>
                  {i.expired ? <StatusPill tone="neutral">Caducada</StatusPill> : <StatusPill tone="warning">Pendiente</StatusPill>}
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resendInvitation({ id: i.id }), "Invitación reenviada")}><RotateCw /> Reenviar</Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeInvitation({ id: i.id }), "Invitación anulada")}><X /> Anular</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Usuarios ({members.length})</h2>
        <Table>
          <THead>
            <TR><TH>Persona</TH><TH>Rol</TH><TH>Desde</TH><TH /></TR>
          </THead>
          <TBody>
            {members.map((m) => (
              <TR key={m.id}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">{initials(m.name)}</span>
                    <span>
                      <span className="block font-medium">{m.name}{m.userId === me && <span className="ml-1 text-xs font-normal text-muted-foreground">(tú)</span>}</span>
                      <span className="block text-xs text-muted-foreground">{m.email}</span>
                    </span>
                  </div>
                </TD>
                <TD>
                  <NativeSelect aria-label={`Rol de ${m.name}`} className="w-48" value={m.role} disabled={pending || m.userId === me} onChange={(e) => run(() => changeRole({ memberId: m.id, role: e.target.value as Role }), "Rol actualizado")}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </NativeSelect>
                </TD>
                <TD className="text-muted-foreground">{formatDate(m.createdAt)}</TD>
                <TD className="text-right">
                  {m.userId !== me && (
                    <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => confirm(`¿Quitar a ${m.name} de la empresa?`) && run(() => removeMember({ memberId: m.id }), "Usuario retirado")}>
                      <Trash2 /> Quitar
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Permisos por rol</CardTitle>
            <CardDescription>Qué puede hacer cada rol en la aplicación.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 text-left font-normal">Permiso</th>
                {ROLES.map((r) => <th key={r} className="px-2 py-2 text-center font-normal">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p} className="border-b last:border-0">
                  <td className="py-2">{PERMISSION_LABELS[p]}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">{ROLE_PERMISSIONS[r].has(p) ? <Check className="mx-auto size-4 text-success" aria-label="Sí" /> : <span className="text-muted-foreground" aria-label="No">·</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Permisos por campo</CardTitle>
            <CardDescription>Datos sensibles que cada rol puede ver en pedidos, proyectos y personal.</CardDescription>
          </div>
          <Button size="sm" disabled={pending} onClick={() => run(() => saveFieldPermissions({ permissions: fp as Record<string, Record<"margen" | "coste" | "coste_hora", boolean>> }), "Permisos por campo guardados")}>Guardar</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-1 text-sm" style={{ gridTemplateColumns: `minmax(140px,1fr) repeat(${FIELDS.length}, minmax(0,140px))` }}>
            <span />
            {FIELDS.map((f) => <span key={f.key} className="pb-2 text-xs text-muted-foreground">{f.label}</span>)}
            {ROLES.map((r) => (
              <Fragment key={r}>
                <span className="py-1.5">{ROLE_LABELS[r]}</span>
                {FIELDS.map((f) => (
                  <span key={f.key} className="py-1.5">
                    <Switch
                      aria-label={`${ROLE_LABELS[r]} ve ${f.label}`}
                      checked={canSeeField(r, f.key, fp)}
                      disabled={r === "administrador"}
                      onCheckedChange={(v) => setFp({ ...fp, [r]: { ...(fp[r] ?? {}), [f.key]: v } })}
                    />
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
