"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
      <Button
        size="icon"
        variant="outline"
        aria-label={`Copiar ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast.success("Copiado");
          } catch {
            toast.error("No se pudo copiar");
          }
        }}
      >
        <Copy />
      </Button>
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.push("/acceso");
        router.refresh();
      }}
    >
      <LogOut /> Cerrar sesión
    </Button>
  );
}
