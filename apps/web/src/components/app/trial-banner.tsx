import Link from "next/link";
import { now } from "@/lib/now";

export function TrialBanner({ status, trialEndsAt }: { status: string; trialEndsAt: string | null }) {
  if (status === "active") return null;
  const days = trialEndsAt ? Math.ceil((new Date(trialEndsAt).getTime() - now()) / 86_400_000) : null;
  if (status === "trialing" && days !== null && days > 7) return null;
  const expired = status === "past_due" || status === "canceled" || (days !== null && days <= 0);
  return (
    <div className={`flex items-center justify-center gap-2 border-b px-4 py-1.5 text-center text-[13px] ${expired ? "bg-danger-bg text-danger" : "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200"}`}>
      {expired ? "Tu suscripción no está activa." : `Te quedan ${days} día${days === 1 ? "" : "s"} de prueba.`}
      <Link href="/app/configuracion/suscripcion" className="font-medium underline underline-offset-2">
        {expired ? "Reactivar" : "Elegir plan"}
      </Link>
    </div>
  );
}
