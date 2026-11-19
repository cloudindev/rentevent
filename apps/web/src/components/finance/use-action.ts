"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

/** Runs a server action with toast feedback and a router refresh. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run<T>(p: () => Promise<ActionResult<T>>, opts: { success?: string; onOk?: (data: T) => void; onError?: (r: Extract<ActionResult<T>, { ok: false }>) => void } = {}) {
    start(async () => {
      const r = await p();
      if (!r.ok) {
        toast.error(r.error);
        opts.onError?.(r);
        return;
      }
      if (opts.success) toast.success(opts.success);
      opts.onOk?.(r.data);
      router.refresh();
    });
  }
  return { pending, run };
}
