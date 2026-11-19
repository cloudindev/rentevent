import "server-only";

const v = (k: string) => {
  const x = process.env[k];
  return x && x.trim() !== "" ? x.trim() : undefined;
};

const isProd = process.env.NODE_ENV === "production";

export const env = {
  isProd,
  appUrl: v("APP_URL") ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  rootDomain: v("ROOT_DOMAIN") ?? "localhost:3000",
  authSecret: v("AUTH_SECRET") ?? "rentevent-dev-secret-change-me-0123456789abcdef",
  cronSecret: v("CRON_SECRET") ?? "dev-cron-secret",
  redisUrl: v("REDIS_URL"),
  smtpUrl: v("SMTP_URL"),
  emailFrom: v("EMAIL_FROM") ?? "Rentevent <no-reply@rentevent.es>",
  s3: v("S3_BUCKET")
    ? {
        bucket: v("S3_BUCKET")!,
        region: v("S3_REGION") ?? "eu-west-1",
        endpoint: v("S3_ENDPOINT"),
        accessKeyId: v("S3_ACCESS_KEY_ID") ?? "",
        secretAccessKey: v("S3_SECRET_ACCESS_KEY") ?? "",
      }
    : null,
  stripe: v("STRIPE_SECRET_KEY") ? { secretKey: v("STRIPE_SECRET_KEY")!, webhookSecret: v("STRIPE_WEBHOOK_SECRET") ?? "" } : null,
  google: v("GOOGLE_CLIENT_ID") ? { clientId: v("GOOGLE_CLIENT_ID")!, clientSecret: v("GOOGLE_CLIENT_SECRET") ?? "" } : null,
  microsoft: v("MICROSOFT_CLIENT_ID")
    ? { clientId: v("MICROSOFT_CLIENT_ID")!, clientSecret: v("MICROSOFT_CLIENT_SECRET") ?? "", tenantId: v("MICROSOFT_TENANT_ID") ?? "common" }
    : null,
  geocoder: v("GEOCODER_URL") ?? null,
  whatsapp: v("WHATSAPP_TOKEN") ? { token: v("WHATSAPP_TOKEN")!, phoneNumberId: v("WHATSAPP_PHONE_NUMBER_ID") ?? "" } : null,
  anthropicKey: v("ANTHROPIC_API_KEY"),
  aiModel: v("AI_MODEL") ?? "claude-sonnet-5-5",
  vapid: v("VAPID_PUBLIC_KEY") ? { publicKey: v("VAPID_PUBLIC_KEY")!, privateKey: v("VAPID_PRIVATE_KEY") ?? "", subject: v("VAPID_SUBJECT") ?? "mailto:soporte@rentevent.es" } : null,
  demoMode: v("DEMO_MODE") !== "false",
};

export type ServiceMode = "real" | "simulado";
export const serviceModes = (): Record<string, ServiceMode> => ({
  Correo: env.smtpUrl ? "real" : "simulado",
  Almacenamiento: env.s3 ? "real" : "simulado",
  Pagos: env.stripe ? "real" : "simulado",
  "Google OAuth": env.google ? "real" : "simulado",
  "Microsoft OAuth": env.microsoft ? "real" : "simulado",
  Mapas: env.geocoder ? "real" : "simulado",
  WhatsApp: env.whatsapp ? "real" : "simulado",
  "Asistente IA": env.anthropicKey ? "real" : "simulado",
  "Notificaciones push": env.vapid ? "real" : "simulado",
  "Cola de trabajos": env.redisUrl ? "real" : "simulado",
});
