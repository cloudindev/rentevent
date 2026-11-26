import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { account, session, systemDb, twoFactor as twoFactorTable, user, verification } from "@rentevent/db";
import { emailLayout, escapeHtml, sendEmail } from "./adapters/email";
import { env } from "./env";

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
    // no account lockout on wrong passwords; this only slows down bots hammering one IP
    customRules: { "/sign-in/email": { window: 60, max: 30 }, "/forget-password": { window: 300, max: 5 } },
  },
  advanced: { cookiePrefix: "rv" },
  plugins: [twoFactor({ issuer: "Rentevent" }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
