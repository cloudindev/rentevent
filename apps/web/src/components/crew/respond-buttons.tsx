"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondShift } from "@/server/actions/crew";

export function RespondButtons({ shiftId, status }: { shiftId: string; status: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const send = (s: "confirmado" | "rechazado") =>
    start(async () => {
      const r = await respondShift({ shiftId, status: s });
      if (!r.ok) return void toast.error(r.error);
      toast.success(s === "confirmado" ? "Turno confirmado" : "Has rechazado el turno; avisaremos al planificador");
      router.refresh();
    });
  if (status !== "asignado")
    return (
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => send(status === "confirmado" ? "rechazado" : "confirmado")}>
        {status === "confirmado" ? "No puedo ir" : "Confirmar"}
      </Button>
    );
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={busy} onClick={() => send("confirmado")}>
        Confirmar
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => send("rechazado")}>
        Rechazar
      </Button>
    </div>
  );
}
