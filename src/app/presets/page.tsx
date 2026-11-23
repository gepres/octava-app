import type { Metadata } from "next";
import { PresetsView } from "@/components/presets/PresetsView";

export const metadata: Metadata = { title: "Presets" };

export default function PresetsPage() {
  return <PresetsView />;
}
