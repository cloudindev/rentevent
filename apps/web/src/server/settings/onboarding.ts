import "server-only";
import { eq, tenantSettings, type Tx } from "@rentevent/db";

export const ONBOARDING_STEPS = ["Datos fiscales", "Familias de carpa", "Datos del fabricante", "Importar datos", "Equipo", "Listo"] as const;

/** For the home banner: true while the company has not finished the setup wizard. */
export function needsOnboarding(ctx: { onboardingDone: boolean }) {
  return !ctx.onboardingDone;
}

export async function onboardingStep(tx: Tx, tenantId: string) {
  const [s] = await tx.select({ step: tenantSettings.onboardingStep, done: tenantSettings.onboardingDone }).from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId));
  return { step: s?.step ?? 0, done: s?.done ?? false };
}
