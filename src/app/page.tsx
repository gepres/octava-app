import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

const description =
  "Octava es una app de práctica simbólica: compón un código en ocho diales, fija tu intención y el tiempo, y registra cada sesión. Sin cuenta, sin conexión y con tus datos en tu dispositivo.";

export const metadata: Metadata = {
  title: { absolute: "Octava · Ocho diales para sostener tu intención" },
  description,
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Octava",
    title: "Octava · Ocho diales para sostener tu intención",
    description,
  },
};

export default function HomePage() {
  return <Landing />;
}
