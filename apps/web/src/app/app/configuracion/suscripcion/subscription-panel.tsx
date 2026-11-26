"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { cn, formatDate, formatEUR } from "@/lib/utils";
import { monthlyCost, PLANS, type PlanId } from "@/server/billing/plans";
import { seatsError } from "@/server/billing/access";
import { choosePlan, openBillingPortal } from "@/server/actions/settings";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  trialing: { label: "En prueba", tone: "info" },
  active: { label: "Activa", tone: "success" },
  past_due: { label: "Pago pendiente", tone: "danger" },
  canceled: { label: "Cancelada", tone: "danger" },
  incomplete: { label: "Incompleta", tone: "warning" },
};

export function SubscriptionPanel({ plan, status, seats, users, trialEndsAt, daysLeft, hasPortal, simulated, flash }: { plan: string; status: string; seats: number; users: number; trialEndsAt: string | null; daysLeft: number | null; hasPortal: boolean; simulated: boolean; flash: string | null }) {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [n, setN] = useState(Math.max(users, seats));
  const [pending, start] = useTransition();
  const st = STATUS[status] ?? { label: status, tone: "info" as const };
  const maxSeats = Math.max(...PLANS.map((p) => p.seats));
  const tooFew = n < users;
  return (
    <div className="space-y-6">
      {flash && <p className="rounded-xl border bg-success-bg px-4 py-3 text-sm text-success" role="status">{flash}</p>}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Plan actual</p>
          <p className="text-xl font-semibold">{PLANS.find((p) => p.id === plan)?.name ?? "Prueba gratuita"}</p>
          <p className="text-sm text-muted-foreground">
            {users} usuario{users > 1 ? "s" : ""} de {seats} plazas
            {status === "trialing" && daysLeft != null ? ` · ${daysLeft > 0 ? `quedan ${daysLeft} días de prueba (hasta ${formatDate(trialEndsAt)})` : "la prueba ha terminado"}` : ""}
          </p>
        </div>
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        {hasPortal && (
          <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await openBillingPortal({}); if (r.ok && r.data.url) window.location.assign(r.data.url); else toast.error("Portal no disponible"); })}>
            Facturas y método de pago
          </Button>
        )}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={annual} onCheckedChange={setAnnual} /> Pago anual <StatusPill tone="success" dot={false}>−20 %</StatusPill></label>
        <div className="text-right">
          <label className="flex items-center justify-end gap-2 text-sm">Usuarios <Input type="number" min={users} max={maxSeats} value={n} onChange={(e) => setN(Math.max(0, Math.floor(Number(e.target.value) || 0)))} onBlur={() => setN((v) => Math.min(maxSeats, Math.max(users, v)))} className="w-20" aria-label="Número de usuarios" aria-invalid={tooFew || undefined} /></label>
          {tooFew && <p className="mt-1 text-xs text-danger">Ya tienes {users} usuarios: no puedes contratar menos plazas.</p>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const cost = monthlyCost(p.id as PlanId, n, annual);
          const current = p.id === plan && status === "active";
          // seats must fit the plan: at least the current users, at most the plan maximum (Empresa is contracted with sales)
          const seatProblem = p.id === "empresa" ? null : seatsError(p.id, n, users);
          return (
            <article key={p.id} className={cn("flex flex-col rounded-xl border bg-card p-5", p.id === "profesional" && "border-brand-300 ring-1 ring-brand-200")}>
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-4 text-2xl font-semibold">{p.pricePerUser ? `${annual ? Math.round(p.pricePerUser * 0.8) : p.pricePerUser} €` : "A medida"}<span className="text-sm font-normal text-muted-foreground">{p.pricePerUser ? " / usuario / mes" : ""}</span></p>
              {seatProblem && !tooFew ? (
                <p className="text-xs text-danger">{users > p.seats ? `Tienes ${users} usuarios y este plan admite hasta ${p.seats}.` : `Este plan admite hasta ${p.seats} usuarios.`}</p>
              ) : (
                cost != null && <p className="text-xs text-muted-foreground">{formatEUR(cost)} al mes para {n} usuarios{annual ? ", facturado anualmente" : ""} · IVA no incluido</p>
              )}
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>)}
              </ul>
              <Button
                className="mt-5"
                variant={p.id === "profesional" ? "default" : "outline"}
                disabled={pending || current || Boolean(seatProblem)}
                onClick={() =>
                  p.id === "empresa"
                    ? router.push("/contacto")
                    : start(async () => {
                        const r = await choosePlan({ plan: p.id, seats: n, annual });
                        if (!r.ok) {
                          toast.error(r.error);
                          return;
                        }
                        window.location.assign(r.data.url);
                      })
                }
              >
                {current ? "Plan actual" : p.id === "empresa" ? "Hablar con ventas" : "Elegir plan"}
              </Button>
            </article>
          );
        })}
      </div>
      {simulated && <p className="text-xs text-muted-foreground">Pagos en modo simulado: configura STRIPE_SECRET_KEY y los precios STRIPE_PRICE_* para cobrar con Stripe Billing.</p>}
    </div>
  );
}
