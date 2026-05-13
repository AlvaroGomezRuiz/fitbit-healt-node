import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import type * as React from "react";

import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Salud — Fitbit Health Node",
  description: "Cáscara móvil (fase 3). Contenido de demostración hasta integrar fases 1 y 2.",
  applicationName: "Fitbit Health Node",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Salud",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="es" className={`dark ${geistSans.variable}`} suppressHydrationWarning>
      <body className={`${geistSans.className} min-h-dvh bg-background text-foreground antialiased`}>
        <a className="skip-link" href="#contenido-principal">
          Saltar al contenido
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
