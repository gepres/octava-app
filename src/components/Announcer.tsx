"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const Ctx = createContext<(message: string) => void>(() => undefined);

/** Región viva para anunciar transiciones importantes. Nunca para cada segundo. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const announce = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    // Vaciar y volver a poner fuerza el anuncio aunque el texto se repita.
    setMsg("");
    timer.current = window.setTimeout(() => setMsg(message), 60);
  }, []);
  return (
    <Ctx.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {msg}
      </div>
    </Ctx.Provider>
  );
}

export function useAnnounce() {
  return useContext(Ctx);
}
