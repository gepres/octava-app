"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

/** Hora actual que se refresca cada `ms` mientras `active`. Solo repinta: el estado real está persistido. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, ms]);
  return now;
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

const pendingRevokes = new Map<string, number>();

/** URL temporal para previsualizar un Blob. Se revoca al cambiar o desmontar. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    if (!url) return;
    // Un montaje repetido (modo estricto) cancela la revocación pendiente de la misma URL.
    window.clearTimeout(pendingRevokes.get(url));
    pendingRevokes.delete(url);
    return () => {
      pendingRevokes.set(
        url,
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          pendingRevokes.delete(url);
        }, 0),
      );
    };
  }, [url]);
  return url;
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
    () => document.visibilityState === "visible",
    () => true,
  );
}
