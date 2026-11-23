"use client";

/**
 * Instalación y service worker.
 * - El worker solo se registra en producción (build exportado), nunca en `next dev`.
 * - El botón «Instalar» solo aparece si el navegador entregó `beforeinstallprompt`.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;

function emit() {
  listeners.forEach((l) => l());
}

export function startPwa(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(
        () => emit(),
        () => undefined,
      );
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    navigator.serviceWorker.addEventListener("controllerchange", emit);
    void navigator.serviceWorker.ready.then(() => emit());
  }
}

export function subscribePwa(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;
  emit();
  await ev.prompt();
  const choice = await ev.userChoice;
  return choice.outcome === "accepted";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    installed ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type Platform = "ios" | "android" | "mac-safari" | "desktop" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/.test(ua)) return "android";
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  if (/Macintosh/.test(ua) && safari) return "mac-safari";
  return "desktop";
}

/** El worker controla la página: el núcleo de la app ya está guardado para usarse sin red. */
export function offlineReady(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && navigator.serviceWorker.controller !== null;
}
