"use client";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { switchWorkspace } from "@/server/actions/workspace";
import { initials } from "@/lib/utils";

export function WorkspaceButton({ tenantId, name, role }: { tenantId: string; name: string; role: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await switchWorkspace({ tenantId });
        router.push("/app/inicio");
        router.refresh();
      }}
      className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left hover:bg-subtle"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-white dark:bg-white dark:text-ink">{initials(name)}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{name}</span>
        <span className="block text-xs text-muted-foreground">{role}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}
