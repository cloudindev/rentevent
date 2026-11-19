"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, CloudOff, QrCode, RefreshCw, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { flushOutbox, listOutbox } from "./outbox";

const TABS = [
  { href: "/m", label: "Agenda", icon: CalendarDays },
  { href: "/m/fichar", label: "Fichar", icon: Clock },
  { href: "/m/escanear", label: "Escanear", icon: QrCode },
  { href: "/m/perfil", label: "Perfil", icon: User },
];

export function MobileShell({ children, company }: { children: React.ReactNode; company: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    const refresh = async () => setPending((await listOutbox()).length);
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return refresh();
      const r = await flushOutbox();
      if (r.sent) {
        toast.success(`${r.sent} acción${r.sent === 1 ? "" : "es"} sincronizada${r.sent === 1 ? "" : "s"}`);
        router.refresh();
      }
      if (r.failed) toast.error(`${r.failed} acción${r.failed === 1 ? "" : "es"} no se pudo${r.failed === 1 ? "" : "ieron"} sincronizar`);
      refresh();
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("rv-outbox", refresh);
    const t = setInterval(sync, 60_000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("rv-outbox", refresh);
      clearInterval(t);
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-canvas">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
        <img src="/brand/rentevent-mark.png" alt="" className="h-5 w-auto dark:hidden" />
        <img src="/brand/rentevent-mark-white.png" alt="" className="hidden h-5 w-auto dark:block" />
        <span className="flex-1 truncate text-sm font-semibold">{company}</span>
        {(!online || pending > 0) && (
          <button onClick={() => flushOutbox().then(() => router.refresh())} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", online ? "bg-warning-bg text-warning" : "bg-secondary text-muted-foreground")} aria-label="Sincronizar">
            {online ? <RefreshCw className="size-3" /> : <CloudOff className="size-3" />}
            {online ? `${pending} pendiente${pending === 1 ? "" : "s"}` : `Sin conexión${pending ? ` · ${pending}` : ""}`}
          </button>
        )}
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Navegación de la app">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map((t) => {
            const active = t.href === "/m" ? pathname === "/m" || pathname.startsWith("/m/turno") : pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground", active && "font-medium text-foreground")}>
                <t.icon className={cn("size-5", active && "text-primary")} strokeWidth={1.7} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
