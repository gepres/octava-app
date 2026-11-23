import type { Metadata } from "next";
import { SesionView } from "@/components/session/SesionView";

export const metadata: Metadata = { title: "Sesión" };

export default function SesionPage() {
  return <SesionView />;
}
