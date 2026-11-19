import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compositionSchema, computeCompositionBom } from "@rentevent/core";
import { eq, organization, systemDb, tentConfigurations, tenantSettings, withTenant } from "@rentevent/db";
import { loadCatalog } from "@/server/catalog";
import { formatNumber, initials } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { PublicViewer } from "./public-viewer";

export const metadata: Metadata = { title: "Tu carpa en 3D", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function load(token: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  const [row] = await systemDb()
    .select({ id: tentConfigurations.id, tenantId: tentConfigurations.tenantId, label: tentConfigurations.label, composition: tentConfigurations.composition, company: organization.name, logo: tenantSettings.logoUrl, phone: tenantSettings.phone, email: tenantSettings.email })
    .from(tentConfigurations)
    .innerJoin(organization, eq(organization.id, tentConfigurations.tenantId))
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tentConfigurations.tenantId))
    .where(eq(tentConfigurations.shareToken, token));
  if (!row) return null;
  const parsed = compositionSchema.safeParse(row.composition);
  if (!parsed.success) return null;
  const catalog = await withTenant(row.tenantId, (tx) => loadCatalog(tx, { includeInactive: true }));
  return { ...row, composition: parsed.data, catalog };
}

export default async function PublicTentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await load(token);
  if (!data) notFound();
  const { composition, catalog } = data;
  const bom = computeCompositionBom({ composition, families: catalog.families, rules: catalog.rules, items: catalog.items });
  const tents = composition.tents.map((t) => {
    const f = catalog.families.find((x) => x.id === t.config.familyId);
    return { label: t.label || f?.name || "Carpa", dims: f ? `${f.width} × ${f.roofShape === "jaima" ? f.width : t.config.modules * f.moduleLength} m` : "" };
  });
  const aforo = bom.tents.reduce((s, t) => ({ coctel: s.coctel + t.result.metrics.aforo.coctel, banquete: s.banquete + t.result.metrics.aforo.banquete, plazas: s.plazas + t.result.metrics.plazas }), { coctel: 0, banquete: 0, plazas: 0 });
  // only what the viewer needs crosses to the client (no prices, no stock)
  const items = catalog.items.map(({ id, name, sku, unit, weightKg, volumeM3, role, roleAmount }) => ({ id, name, sku, unit, weightKg, volumeM3, role, roleAmount }));
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          {data.logo ? (
            <img src={data.logo} alt={data.company} className="h-8 w-auto" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-white dark:bg-white dark:text-ink">{initials(data.company)}</span>
          )}
          <div>
            <p className="text-sm font-semibold">{data.company}</p>
            <p className="text-xs text-muted-foreground">{data.label}</p>
          </div>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">Vista de solo lectura</span>
      </header>
      <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
        <PublicViewer composition={composition} families={catalog.families} items={items} rules={catalog.rules} />
        <aside className="space-y-3">
          <div className="rounded-xl border bg-background p-4">
            <h1 className="text-lg font-semibold">{data.label}</h1>
            <ul className="mt-2 space-y-1 text-sm">
              {tents.map((t, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{t.label}</span>
                  <span className="tabular text-muted-foreground">{t.dims}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Superficie", `${formatNumber(bom.totals.superficie)} m²`],
              ["Aforo de pie", `${formatNumber(aforo.coctel)} pers.`],
              ["Aforo banquete", `${formatNumber(aforo.banquete)} pers.`],
              ["Plazas sentadas", aforo.plazas ? formatNumber(aforo.plazas) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-background p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-0.5 font-medium tabular">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Aforos orientativos. Arrastra para girar la vista, rueda o pellizca para acercar.</p>
          {(data.phone || data.email) && (
            <p className="text-sm">
              ¿Dudas? {data.phone && <a className="text-link hover:underline" href={`tel:${data.phone}`}>{data.phone}</a>} {data.email && <a className="text-link hover:underline" href={`mailto:${data.email}`}>{data.email}</a>}
            </p>
          )}
        </aside>
      </main>
      <footer className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        Creado con <Logo height={14} href="/" />
      </footer>
    </div>
  );
}
