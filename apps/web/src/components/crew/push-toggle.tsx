"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");
  useEffect(() => {
    const detect = async (): Promise<typeof state> => {
      if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      return sub ? "on" : "off";
    };
    void detect().then(setState);
  }, [vapidKey]);
  if (!vapidKey) return <p className="text-sm text-muted-foreground">Notificaciones simuladas: el administrador aún no ha configurado las claves push. Los avisos se registran en Comunicación.</p>;
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">Este navegador no admite notificaciones push. En iPhone, añade la app a la pantalla de inicio primero.</p>;
  if (state === "denied") return <p className="text-sm text-muted-foreground">Has bloqueado las notificaciones. Actívalas en los ajustes del navegador.</p>;
  return state === "on" ? (
    <Button
      variant="outline"
      onClick={async () => {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setState("off");
      }}
    >
      <BellOff /> Desactivar avisos
    </Button>
  ) : (
    <Button
      disabled={state === "loading"}
      onClick={async () => {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
        if (!res.ok) return void toast.error("No se pudo activar");
        toast.success("Avisos activados");
        setState("on");
      }}
    >
      <Bell /> Activar avisos en este móvil
    </Button>
  );
}
