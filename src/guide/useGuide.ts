"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useReducedMotion } from "@/hooks/misc";
import { GUIDE_PARAM, consumeGuideParam, startGuide, type GuideId } from "./guide";

/**
 * Devuelve `open(returnFocus?)` para lanzar la guía de una sección y,
 * cuando la página está lista, continúa la guía si se llegó con `?guia=1`.
 */
export function useGuide(id: GuideId, ready: boolean) {
  const router = useRouter();
  const reduced = useReducedMotion();

  const open = useCallback(
    (returnFocus?: HTMLElement | null) => {
      void startGuide(id, { navigate: (href) => router.push(href), reducedMotion: reduced, returnFocus });
    },
    [id, reduced, router],
  );

  useEffect(() => {
    if (!ready || new URLSearchParams(window.location.search).get(GUIDE_PARAM) !== "1") return;
    // Se consume dentro del temporizador: así un montaje doble no la pierde.
    const t = window.setTimeout(() => {
      if (consumeGuideParam()) open();
    }, 150);
    return () => window.clearTimeout(t);
  }, [ready, open]);

  return open;
}
