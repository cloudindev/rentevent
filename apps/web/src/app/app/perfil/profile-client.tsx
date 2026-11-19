"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { formatDateTime } from "@/lib/utils";
import { updateProfile } from "@/server/actions/users";

type Sess = { id: string; token: string; userAgent?: string | null; ipAddress?: string | null; createdAt: string | Date; updatedAt: string | Date };

function deviceName(ua?: string | null) {
  if (!ua) return "Dispositivo desconocido";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Otro";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} en ${os}`;
}

export function ProfileClient({ name, email, locale, twoFactor, currentSessionId }: { name: string; email: string; locale: string; twoFactor: boolean; currentSessionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [p, setP] = useState({ name, locale });
  const [pw, setPw] = useState({ current: "", next: "", next2: "", revoke: true });
  const [tf, setTf] = useState<{ enabled: boolean; setup: { qr: string; uri: string; backup: string[] } | null; password: string; code: string }>({ enabled: twoFactor, setup: null, password: "", code: "" });
  const [sessions, setSessions] = useState<Sess[] | null>(null);

  const loadSessions = useCallback(async () => {
    const r = await authClient.listSessions();
    setSessions((r.data as Sess[] | null) ?? []);
  }, []);
  useEffect(() => {
    let alive = true;
    authClient.listSessions().then((r) => {
      if (alive) setSessions((r.data as Sess[] | null) ?? []);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><div><CardTitle>Tus datos</CardTitle><CardDescription>{email}</CardDescription></div></CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await updateProfile(p);
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                toast.success("Perfil guardado");
                router.refresh();
              });
            }}
          >
            <Field label="Nombre" htmlFor="pf-name" className="min-w-56 flex-1"><Input id="pf-name" autoComplete="name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
            <Field label="Idioma" htmlFor="pf-lang">
              <NativeSelect id="pf-lang" value={p.locale} onChange={(e) => setP({ ...p, locale: e.target.value })}>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="pt">Português</option>
              </NativeSelect>
            </Field>
            <Button disabled={pending}>Guardar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Contraseña</CardTitle><CardDescription>Mínimo 10 caracteres.</CardDescription></div></CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pw.next.length < 10) return void toast.error("La nueva contraseña necesita al menos 10 caracteres");
              if (pw.next !== pw.next2) return void toast.error("Las contraseñas no coinciden");
              start(async () => {
                const r = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: pw.revoke });
                if (r.error) {
                  toast.error("La contraseña actual no es correcta");
                  return;
                }
                toast.success("Contraseña cambiada");
                setPw({ current: "", next: "", next2: "", revoke: true });
                void loadSessions();
              });
            }}
          >
            <Field label="Actual" htmlFor="pw-c"><Input id="pw-c" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="Nueva" htmlFor="pw-n"><Input id="pw-n" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Repite la nueva" htmlFor="pw-n2"><Input id="pw-n2" type="password" autoComplete="new-password" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={pw.revoke} onCheckedChange={(v) => setPw({ ...pw, revoke: v })} /> Cerrar sesión en los demás dispositivos</label>
            <div className="flex justify-end"><Button disabled={pending || !pw.current}>Cambiar contraseña</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Verificación en dos pasos</CardTitle>
            <CardDescription>Pide un código de tu app de autenticación (Google Authenticator, 1Password, Authy…) al iniciar sesión.</CardDescription>
          </div>
          <StatusPill tone={tf.enabled ? "success" : "neutral"}>{tf.enabled ? "Activada" : "Desactivada"}</StatusPill>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tf.setup && (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Tu contraseña" htmlFor="tf-pw" className="min-w-56 flex-1"><Input id="tf-pw" type="password" autoComplete="current-password" value={tf.password} onChange={(e) => setTf({ ...tf, password: e.target.value })} /></Field>
              {tf.enabled ? (
                <Button
                  variant="outline"
                  disabled={pending || !tf.password}
                  onClick={() =>
                    start(async () => {
                      const r = await authClient.twoFactor.disable({ password: tf.password });
                      if (r.error) {
                        toast.error("Contraseña incorrecta");
                        return;
                      }
                      setTf({ enabled: false, setup: null, password: "", code: "" });
                      toast.success("Verificación en dos pasos desactivada");
                    })
                  }
                >
                  Desactivar
                </Button>
              ) : (
                <Button
                  disabled={pending || !tf.password}
                  onClick={() =>
                    start(async () => {
                      const r = await authClient.twoFactor.enable({ password: tf.password });
                      if (r.error || !r.data || !("totpURI" in r.data)) {
                        toast.error("Contraseña incorrecta");
                        return;
                      }
                      const qr = await QRCode.toDataURL(r.data.totpURI, { margin: 1, width: 200 });
                      setTf({ ...tf, setup: { qr, uri: r.data.totpURI, backup: r.data.backupCodes }, password: "" });
                    })
                  }
                >
                  <ShieldCheck /> Activar
                </Button>
              )}
            </div>
          )}
          {tf.setup && (
            <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
              <img src={tf.setup.qr} alt="Código QR para la app de autenticación" className="size-[200px] rounded-lg border bg-white p-2" />
              <div className="space-y-3 text-sm">
                <p>1. Escanea el código con tu app. 2. Escribe el código de 6 dígitos para terminar.</p>
                <p className="break-all text-xs text-muted-foreground">{tf.setup.uri}</p>
                <div>
                  <p className="font-medium">Códigos de respaldo</p>
                  <p className="text-xs text-muted-foreground">Guárdalos en un lugar seguro: cada uno sirve una vez si pierdes el móvil.</p>
                  <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">{tf.setup.backup.map((c) => <span key={c} className="rounded bg-muted px-2 py-1">{c}</span>)}</div>
                </div>
                <div className="flex items-end gap-2">
                  <Field label="Código" htmlFor="tf-code"><Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" className="w-32" value={tf.code} onChange={(e) => setTf({ ...tf, code: e.target.value.trim() })} /></Field>
                  <Button
                    disabled={pending || tf.code.length < 6}
                    onClick={() =>
                      start(async () => {
                        const r = await authClient.twoFactor.verifyTotp({ code: tf.code });
                        if (r.error) {
                          toast.error("Código incorrecto");
                          return;
                        }
                        setTf({ enabled: true, setup: null, password: "", code: "" });
                        toast.success("Verificación en dos pasos activada");
                        router.refresh();
                      })
                    }
                  >
                    Verificar y activar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div><CardTitle>Sesiones activas</CardTitle><CardDescription>Dispositivos con tu cuenta abierta.</CardDescription></div>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await authClient.revokeOtherSessions(); toast.success("Se han cerrado las demás sesiones"); void loadSessions(); })}>Cerrar las demás</Button>
        </CardHeader>
        <CardContent>
          {sessions === null ? (
            <div className="skeleton h-16" />
          ) : (
            <ul className="divide-y text-sm">
              {sessions.map((s) => {
                const mine = s.id === currentSessionId;
                const mobile = /Mobile|Android|iPhone/.test(s.userAgent ?? "");
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    {mobile ? <Smartphone className="size-4 text-muted-foreground" /> : <Monitor className="size-4 text-muted-foreground" />}
                    <span className="flex-1">
                      <span className="block font-medium">{deviceName(s.userAgent)}{mine && <span className="ml-1 text-xs font-normal text-success">(esta sesión)</span>}</span>
                      <span className="block text-xs text-muted-foreground">{s.ipAddress ?? "IP desconocida"} · activa {formatDateTime(s.updatedAt)}</span>
                    </span>
                    {!mine && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await authClient.revokeSession({ token: s.token }); void loadSessions(); })}>Cerrar</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={async () => { await authClient.signOut(); router.push("/acceso"); router.refresh(); }}><LogOut /> Cerrar sesión</Button>
      </div>
    </div>
  );
}
