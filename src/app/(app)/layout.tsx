import { AppShell } from "@/components/AppShell";

/** Las secciones de la app comparten el menú, la reconciliación de sesiones y el registro del SW. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
