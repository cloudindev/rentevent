"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, PartyPopper, Tent, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ROLES, type Role } from "@rentevent/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/menu";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { installCatalogue, saveOnboardingStep } from "@/server/actions/settings";
import { inviteUser } from "@/server/actions/users";
import { CompanyForm, type CompanyValues } from "../configuracion/company-form";
import { Importer } from "../configuracion/importar/importer";

const STEPS = ["Datos fiscales", "Familias de carpa", "Datos del fabricante", "Importar datos", "Equipo", "Listo"];
const WIDTHS = [7, 10, 14, 15, 20];

export function Wizard({ initialStep, slug, company, logoUrl, familyCount, pendingFamilies, canImport }: { initialStep: number; slug: string; company: CompanyValues; logoUrl: string | null; familyCount: number; pendingFamilies: number; canImport: Record<"inventario" | "contactos" | "proyectos", boolean> }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [pending, start] = useTransition();
  const [widths, setWidths] = useState<number[]>(WIDTHS);
  const [jaima, setJaima] = useState(true);
  const [keepStock, setKeepStock] = useState(false);
  const [installed, setInstalled] = useState(familyCount > 0);
  const [invites, setInvites] = useState<{ email: string; role: Role }[]>([{ email: "", role: "comercial" }]);
  const [sent, setSent] = useState<string[]>([]);

  const go = (n: number, done = false) =>
    start(async () => {
      await saveOnboardingStep({ step: n, done });
      if (done) {
        toast.success("¡Todo listo!");
        router.push("/app/inicio");
        router.refresh();
        return;
      }
      setStep(n);
      window.scrollTo({ top: 0 });
    });

  const nav = (
    <div className="flex justify-between pt-2">
      <Button variant="ghost" disabled={step === 0 || pending} onClick={() => go(step - 1)}>Atrás</Button>
      <div className="flex gap-2">
        {/* only rendered on steps 0–4; the last step ("Listo") has its own "Crear un pedido" / "Ir al inicio" buttons that finish the wizard */}
        <Button variant="outline" disabled={pending} onClick={() => go(step + 1)}>Saltar</Button>
        <Button disabled={pending} onClick={() => go(step + 1)}>Continuar</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => go(i)} className={cn("w-full rounded-lg border px-2 py-2 text-left text-xs", i === step ? "border-brand-400 bg-brand-50 font-medium dark:bg-brand-950" : i < step ? "text-foreground" : "text-muted-foreground")} aria-current={i === step ? "step" : undefined}>
              <span className={cn("mb-1 flex size-5 items-center justify-center rounded-full border text-[10px]", i < step && "border-success bg-success text-white")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <CompanyForm initial={company} logoUrl={logoUrl} base={null} slug={slug} compact onSaved={() => go(1)} />
          {nav}
        </>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Familias de carpa</CardTitle>
              <CardDescription>Empieza con un catálogo de ejemplo (cerchas, lonas, laterales, pesos, suelos y sus reglas de despiece) y ajústalo, o crea tus familias desde cero.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {installed ? (
              <p className="flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success"><Check className="size-4" /> Ya tienes familias de carpa. Puedes revisarlas en <Link className="underline" href="/app/carpas">Carpas</Link>.</p>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-[13px] font-medium">Anchos que trabajas</p>
                  <div className="flex flex-wrap gap-3">
                    {WIDTHS.map((w) => (
                      <label key={w} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <Checkbox checked={widths.includes(w)} onCheckedChange={(v) => setWidths(v ? [...widths, w] : widths.filter((x) => x !== w))} /> {w} m
                      </label>
                    ))}
                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Checkbox checked={jaima} onCheckedChange={(v) => setJaima(v === true)} /> Jaimas 5x5</label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={keepStock} onCheckedChange={setKeepStock} /> Rellenar con stock de ejemplo (si no, el stock empieza a 0)</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending || (widths.length === 0 && !jaima)}
                    onClick={() =>
                      start(async () => {
                        const r = await installCatalogue({ widths, includeJaima: jaima, keepStock });
                        if (!r.ok) {
                          toast.error(r.error);
                          return;
                        }
                        setInstalled(true);
                        toast.success(`${r.data.families} familias, ${r.data.items} artículos y ${r.data.rules} reglas creadas`);
                        router.refresh();
                      })
                    }
                  >
                    <Tent /> Cargar catálogo de ejemplo
                  </Button>
                  <Button asChild variant="outline"><Link href="/app/carpas">Crear desde cero</Link></Button>
                </div>
              </>
            )}
            {nav}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Datos de tu fabricante</CardTitle>
              <CardDescription>Correas por tramo, pesos y estacas por pata o tensores dependen del fabricante de tu estructura. Los valores de ejemplo están marcados como pendientes.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{pendingFamilies > 0 ? `${pendingFamilies} familia${pendingFamilies > 1 ? "s" : ""} con datos por validar.` : "No hay familias pendientes de validar."}</p>
            <Button asChild variant="outline"><Link href="/app/carpas/asistente">Abrir el asistente de fabricante</Link></Button>
            {nav}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <>
          <Importer allowed={canImport} compact />
          {nav}
        </>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Invita a tu equipo</CardTitle>
              <CardDescription>Comerciales, almacén, jefes de equipo y montadores. Cada uno recibirá un correo.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((inv, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <Field label="Correo" htmlFor={`ob-e-${i}`} className="min-w-56 flex-1"><Input id={`ob-e-${i}`} type="email" value={inv.email} disabled={sent.includes(inv.email)} onChange={(e) => setInvites(invites.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} /></Field>
                <Field label="Rol" htmlFor={`ob-r-${i}`}>
                  <NativeSelect id={`ob-r-${i}`} value={inv.role} disabled={sent.includes(inv.email)} onChange={(e) => setInvites(invites.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)))}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </NativeSelect>
                </Field>
                {sent.includes(inv.email) && <span className="pb-2 text-sm text-success">Enviada</span>}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setInvites([...invites, { email: "", role: "montador" }])}>Añadir otra</Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    for (const inv of invites.filter((x) => x.email && !sent.includes(x.email))) {
                      const r = await inviteUser(inv);
                      if (r.ok) setSent((s) => [...s, inv.email]);
                      else toast.error(`${inv.email}: ${r.fieldErrors?.email ?? r.error}`);
                    }
                  })
                }
              >
                <UserPlus /> Enviar invitaciones
              </Button>
            </div>
            {nav}
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <PartyPopper className="mx-auto size-10 text-brand-500" strokeWidth={1.5} />
            <h2 className="text-xl font-semibold">Tu empresa está lista</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">Crea tu primer pedido con una carpa: verás el despiece, la disponibilidad de cerchas y la carpa en 3D al instante.</p>
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline"><Link href="/app/pedidos/nuevo" onClick={() => void saveOnboardingStep({ step: 6, done: true })}>Crear un pedido</Link></Button>
              <Button disabled={pending} onClick={() => go(6, true)}>Ir al inicio</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
