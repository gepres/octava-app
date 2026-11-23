import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// La fuente se descarga en el build y se sirve desde la propia app: funciona sin red.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Octava", template: "%s · Octava" },
  description: "Práctica simbólica de intención y registro personal, con ocho diales y un temporizador.",
  applicationName: "Octava",
  appleWebApp: { capable: true, title: "Octava", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="app-bg min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
