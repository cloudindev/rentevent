"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
export type { TentViewerApi, TentViewerProps } from "./tent-viewer";
export type { TentPlanProps } from "./tent-plan";

function ViewerLoading() {
  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-xl border bg-[#e6ebef]" role="status" aria-label="Cargando vista 3D">
      <Skeleton className="absolute inset-0 h-full rounded-none bg-[#dde3e8]" />
      <span className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">Cargando 3D…</span>
    </div>
  );
}

function PlanLoading() {
  return <Skeleton className="h-full min-h-[280px] w-full rounded-xl" />;
}

/** Three.js viewer, loaded only on the client. */
export const TentViewer = dynamic(() => import("./tent-viewer"), { ssr: false, loading: ViewerLoading });
/** Interactive dimensioned 2D plan (SVG). */
export const TentPlan = dynamic(() => import("./tent-plan"), { ssr: false, loading: PlanLoading });
