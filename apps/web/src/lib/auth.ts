import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { account, eq, session, systemDb, twoFactor as twoFactorTable, user, verification } from "@rentevent/db";
import { emailLayout, escapeHtml, sendEmail } from "./adapters/email";
import { env } from "./env";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

async function lockState(email: string) {
  const [u] = await systemDb()
    .select({ id: user.id, failed: user.failedLoginCount, lockedUntil: user.lockedUntil })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  return u ?? null;
}

export const auth = betterAuth({
  appName: "Rentevent",
  baseURL: env.appUrl,
  secret: env.authSecret,
  trustedOrigins: [env.appUrl, `https://*.${env.rootDomain}`, `http://*.${env.rootDomain}`],
  database: drizzleAdapter(systemDb(), {
    provider: "pg",
    schema: { user, session, account, verification, twoFactor: twoFactorTable },
  }),
  user: {
    additionalFields: {
      locale: { type: "string", required: false, defaultValue: "es", input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: u, url }) => {
      await sendEmail({
        to: u.email,
        subject: "Restablece tu contraseña de Rentevent",
        html: emailLayout({
          title: "Restablecer contraseña",
          body: `<p>Hola ${escapeHtml(u.name)}, hemos recibido una solicitud para cambiar tu contraseña. El enlace caduca en una hora.</p>`,
          cta: { label: "Elegir nueva contraseña", url },
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: u, url }) => {
      await sendEmail({
        to: u.email,
        subject: "Confirma tu correo en Rentevent",
        html: emailLayout({
          title: "Confirma tu correo",
          body: `<p>Hola ${escapeHtml(u.name)}, confirma tu dirección para activar tu cuenta y empezar la prueba gratuita.</p>`,
          cta: { label: "Confirmar correo", url },
        }),
      });
    },
  },
  socialProviders: {
    ...(env.google ? { google: { clientId: env.google.clientId, clientSecret: env.google.clientSecret } } : {}),
    ...(env.microsoft
      ? { microsoft: { clientId: env.microsoft.clientId, clientSecret: env.microsoft.clientSecret, tenantId: env.microsoft.tenantId } }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // signed cookie cache: avoids a session + user query on every navigation;
    // a revoked session stays valid for at most this long
    cookieCache: { enabled: true, maxAge: 2 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 120,
    customRules: { "/sign-in/email": { window: 60, max: 10 }, "/forget-password": { window: 300, max: 5 } },
  },
  advanced: { cookiePrefix: "rv" },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String((ctx.body as { email?: string } | undefined)?.email ?? "");
      const st = await lockState(email);
      if (st?.lockedUntil && st.lockedUntil > new Date()) {
        const mins = Math.ceil((st.lockedUntil.getTime() - Date.now()) / 60000);
        throw new APIError("FORBIDDEN", { message: `Cuenta bloqueada por intentos fallidos. Inténtalo de nuevo en ${mins} min o restablece la contraseña.` });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String((ctx.body as { email?: string } | undefined)?.email ?? "").toLowerCase();
      const st = await lockState(email);
      if (!st) return;
      const failed = ctx.context.returned instanceof APIError;
      if (failed) {
        const count = st.failed + 1;
        await systemDb()
          .update(user)
          .set({ failedLoginCount: count, lockedUntil: count >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null })
          .where(eq(user.id, st.id));
      } else if (st.failed > 0 || st.lockedUntil) {
        await systemDb().update(user).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(user.id, st.id));
      }
    }),
  },
  plugins: [twoFactor({ issuer: "Rentevent" }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
