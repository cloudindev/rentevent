import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Rentevent · Software para empresas de carpas y eventos", template: "%s · Rentevent" },
  description:
    "Configura carpas con despiece automático, comprueba la disponibilidad de stock mientras presupuestas y enseña al cliente su carpa en 3D. ERP completo para alquiler y montaje de carpas.",
  applicationName: "Rentevent",
  manifest: "/manifest.webmanifest",
  openGraph: { type: "website", locale: "es_ES", siteName: "Rentevent", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Rentevent", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
