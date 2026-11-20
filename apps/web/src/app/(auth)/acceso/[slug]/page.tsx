import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq, organization, systemDb, tenantSettings } from "@rentevent/db";
import { env } from "@/lib/env";
import { initials } from "@/lib/utils";
import { AuthSplit } from "@/components/auth-split";
import { LoginForm } from "../login-form";
import { LogoWhite } from "@/components/brand";

async function company(slug: string) {
  const [row] = await systemDb()
    .select({ name: organization.name, logo: tenantSettings.logoUrl, brand: tenantSettings.brandColor })
    .from(organization)
    .leftJoin(tenantSettings, eq(tenantSettings.tenantId, organization.id))
    .where(eq(organization.slug, slug));
  return row ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await company((await params).slug);
  return { title: c ? `Acceso · ${c.name}` : "Acceso", robots: { index: false } };
}

export default async function CompanyLogin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await company(slug);
  if (!c) notFound();
  const logo = c.logo ? (
    <img src={c.logo} alt={c.name} className="h-10 w-auto" />
  ) : (
    <span className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-white dark:bg-white dark:text-ink">{initials(c.name)}</span>
      <span className="text-lg font-semibold">{c.name}</span>
    </span>
  );
  return (
    <AuthSplit
      logo={logo}
      aside={
        <div className="flex h-full flex-col justify-between p-12 text-white">
          <LogoWhite height={22} />
          <div>
            <p className="text-sm uppercase tracking-wider text-white/50">Espacio de trabajo</p>
            <p className="mt-2 text-4xl font-semibold">{c.name}</p>
            <p className="mt-3 text-white/60">{slug}.{env.rootDomain.split(":")[0]}</p>
          </div>
          <p className="text-sm text-white/50">Gestionado con Rentevent</p>
        </div>
      }
    >
      <h1 className="text-2xl font-semibold">Entrar en {c.name}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Usa tu cuenta de Rentevent.</p>
      <Suspense>
        <LoginForm social={{ google: Boolean(env.google), microsoft: Boolean(env.microsoft) }} />
      </Suspense>
    </AuthSplit>
  );
}
