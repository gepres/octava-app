"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribe, type SyncTopic } from "@/sync/channel";

export interface Live<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Lee de IndexedDB y vuelve a leer cuando cambia un tema (en esta pestaña o en otra),
 * al volver a primer plano o al restaurarse la página.
 */
export function useLive<T>(topics: readonly SyncTopic[], loader: () => Promise<T>): Live<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  const seq = useRef(0);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(() => {
    const mine = ++seq.current;
    loaderRef
      .current()
      .then((v) => {
        if (mine !== seq.current) return;
        setData(v);
        setError(null);
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (mine === seq.current) setLoading(false);
      });
  }, []);

  const key = topics.join("|");
  useEffect(() => {
    const seqRef = seq;
    reload();
    const wanted = new Set(key.split("|"));
    const off = subscribe((t) => {
      if (wanted.has(t)) reload();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", reload);
    window.addEventListener("pageshow", reload);
    return () => {
      seqRef.current++; // descarta lecturas en curso
      off();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", reload);
      window.removeEventListener("pageshow", reload);
    };
  }, [key, reload]);

  return { data, error, loading, reload };
}
