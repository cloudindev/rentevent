import { mobileContext } from "@/server/crew/mobile";
import { ScanView } from "./scan-view";

export const metadata = { title: "Escanear" };

/**
 * Generic scan route. `?volver=/ruta` sends each code back as `?codigo=` to
 * the calling screen (e.g. warehouse pick lists); without it, it looks up
 * the item or serial unit.
 */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ volver?: string; codigo?: string }> }) {
  await mobileContext();
  const sp = await searchParams;
  const returnTo = sp.volver && sp.volver.startsWith("/") && !sp.volver.startsWith("//") ? sp.volver : null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Escanear</h1>
      <ScanView returnTo={returnTo} initialCode={sp.codigo?.slice(0, 300) ?? null} />
    </div>
  );
}
