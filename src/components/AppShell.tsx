"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { AnnouncerProvider } from "./Announcer";
import { IconBoard, IconBookmark, IconDatabase, IconHistory, IconSliders } from "./Icons";
import { startPwa } from "@/pwa/pwa";
import { reconcileExpired } from "@/storage/sessions";

const NAV = [
  { href: "/", label: "Tablero", Icon: IconBoard },
  { href: "/presets", label: "Presets", Icon: IconBookmark },
  { href: "/historial", label: "Historial", Icon: IconHistory },
  { href: "/ajustes", label: "Ajustes", Icon: IconSliders },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inSession = pathname === "/sesion";

  useEffect(() => {
    startPwa();
  }, []);

  // Reconciliación en cualquier ruta: si la sesión venció mientras no se miraba, pasa al historial una sola vez.
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void reconcileExpired().catch(() => undefined);
    };
    run();
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, []);

  const isOn = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <AnnouncerProvider>
      <a href="#contenido" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-xl bg-carbon px-4 py-3 text-ink">
        Saltar al contenido
      </a>
      <div className="flex min-h-dvh">
        {!inSession ? (
          <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-7 border-r border-white/[0.06] bg-white/[0.015] px-3.5 py-5 lg:flex">
            <Link href="/" className="flex items-center px-2.5 py-1.5" aria-label="Octava, ir al Tablero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/octava-logo.png" alt="Octava" width={144} height={38} />
            </Link>
            <nav aria-label="Secciones" className="flex flex-col gap-1">
              {NAV.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isOn(href) ? "page" : undefined}
                  className={clsx(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium no-underline transition-colors",
                    isOn(href) ? "bg-turq-deep/[0.12] text-ink [&_svg]:text-turq" : "text-ink-2 hover:bg-white/5 hover:text-ink",
                  )}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="glass mt-auto flex gap-2.5 rounded-[18px] p-3.5 text-[13px] leading-snug text-ink-3">
              <IconDatabase size={18} className="shrink-0 text-copper-light" />
              Todo se guarda en este navegador, sin cuenta.
            </div>
          </aside>
        ) : null}

        <main id="contenido" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>

      {!inSession ? (
        <nav
          aria-label="Secciones"
          className="float fixed inset-x-3 bottom-3 z-30 flex h-[68px] gap-1 rounded-3xl p-1.5 lg:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isOn(href) ? "page" : undefined}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-[3px] rounded-[18px] text-xs font-medium no-underline transition-colors",
                isOn(href) ? "bg-turq-deep/[0.12] text-ink [&_svg]:text-turq" : "text-ink-3 hover:text-ink",
              )}
            >
              <Icon size={22} />
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
    </AnnouncerProvider>
  );
}
