import type { Metadata } from "next";
import { Suspense } from "react";
import { HistorialView } from "@/components/history/HistorialView";

export const metadata: Metadata = { title: "Historial" };

export default function HistorialPage() {
  return (
    // `useSearchParams` (?id=) necesita un límite de Suspense en el export estático.
    <Suspense fallback={<p className="px-4 py-6 text-ink-3 lg:px-9">Cargando…</p>}>
      <HistorialView />
    </Suspense>
  );
}
