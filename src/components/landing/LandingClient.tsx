"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { canPromptInstall, isStandalone, promptInstall, startPwa, subscribePwa } from "@/pwa/pwa";
import { IconDownload } from "@/components/Icons";

/**
 * La portada es para quien llega desde el navegador. Si Octava ya se abre como app instalada
 * (por ejemplo, una instalación anterior cuyo inicio era `/`), se va directo al Tablero.
 * También registra el service worker: la primera visita deja la app lista para usarse sin red.
 */
export function StandaloneRedirect() {
  const router = useRouter();
  useEffect(() => {
    startPwa();
    if (isStandalone()) router.replace("/tablero");
  }, [router]);
  return null;
}

/** Botón de instalación: solo aparece cuando el navegador ofrece instalar la app. */
export function InstallButton() {
  const can = useSyncExternalStore(subscribePwa, canPromptInstall, () => false);
  if (!can) return null;
  return (
    <button type="button" className="btn-go self-start" onClick={() => void promptInstall()}>
      <IconDownload size={18} />
      Instalar Octava
    </button>
  );
}
