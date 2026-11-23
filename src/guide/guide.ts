"use client";

import type { DriveStep, Driver, PopoverDOM } from "driver.js";

/**
 * Guía de uso paso a paso (driver.js). Se abre a petición —desde «Ayuda» o Ajustes—,
 * nunca como pantalla de bienvenida automática. Recorre Tablero → Presets → Historial → Ajustes;
 * la Sesión tiene su propia guía.
 */
export type GuideId = "tablero" | "presets" | "historial" | "ajustes" | "sesion";

/** Parámetro de URL que continúa la guía al llegar a la siguiente sección. */
export const GUIDE_PARAM = "guia";

const NEXT_SECTION: Partial<Record<GuideId, { href: string; label: string }>> = {
  tablero: { href: "/presets", label: "Seguir en Presets" },
  presets: { href: "/historial", label: "Seguir en Historial" },
  historial: { href: "/ajustes", label: "Seguir en Ajustes" },
};

/** Primer elemento visible con ese `data-tour` (móvil y escritorio tienen variantes distintas). */
export function tourTarget(name: string): Element | null {
  const all = document.querySelectorAll(`[data-tour="${name}"]`);
  for (const el of Array.from(all)) {
    if (el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

type Step = { target?: string; title: string; text: string; side?: "top" | "bottom" | "left" | "right" };

const STEPS: Record<GuideId, () => Step[]> = {
  tablero: () => [
    { title: "Así se usa Octava", text: "Un recorrido breve por el Tablero, donde preparas cada sesión. Puedes salir cuando quieras con Escape o con la ×." },
    { target: "slots", title: "Tu código de 8 dígitos", text: "Cada casilla es un dial del 0 al 9. Tócala para elegirla o usa el teclado: ← → cambian de dial, ↑ ↓ cambian su valor y los números lo escriben directamente." },
    { target: "knob", title: "La perilla", text: "Gira la perilla arrastrando, o usa − y +, para ajustar el dial seleccionado. El arco turquesa muestra su valor." },
    { target: "write-code", title: "Escribir o pegar el código", text: "Si ya tienes un código, escríbelo o pégalo de una vez: los diales se ajustan solos y se conservan los ceros iniciales." },
    { target: "intention", title: "Tu intención", text: "Escribe en una frase lo que quieres sostener. Se guarda con la sesión, no en el preset." },
    { target: "duration", title: "Duración", text: "De 1 a 60 minutos. Empieza en 5." },
    { target: "witness", title: "Testigo · opcional", text: "Una referencia de la sesión: un nombre, una imagen o ambos. La imagen se guarda solo en este dispositivo." },
    { target: "sound", title: "Sonido ambiental", text: "Un tono suave y continuo de 220, 432 o 440 Hz. Parte apagado; el tono y el volumen se eligen en Ajustes." },
    { target: "save-preset", title: "Guardar como preset", text: "Guarda el código, la duración y el tono para reutilizarlos después. La intención y el testigo son de cada sesión." },
    { target: "start", title: "Iniciar sesión", text: "Empieza la cuenta atrás. En la sesión puedes pausar, reanudar o finalizar antes, y al terminar dejar una nota. Si cierras la pestaña, el tiempo sigue contando." },
    { target: "nav", title: "Tus secciones", text: "Presets guarda configuraciones, Historial tus sesiones con sus notas y Ajustes el sonido, el movimiento y la instalación." },
  ],
  presets: () => [
    { target: "preset-card", title: "Un preset", text: "Guarda código, duración y tono. Los tres ejemplos llevan códigos ilustrativos." },
    { target: "preset-apply", title: "Aplicar", text: "Carga el preset en el Tablero sin iniciar la sesión." },
    { target: "preset-edit", title: "Editar o eliminar", text: "Con el lápiz cambias sus valores o lo eliminas. Las sesiones pasadas conservan los suyos." },
    { target: "preset-new", title: "Nuevo preset", text: "Crea uno desde aquí, o desde el Tablero con «Guardar como preset»." },
  ],
  historial: () => [
    { target: "history-empty", title: "Aquí aparecerán tus sesiones", text: "Cuando termines una sesión aparecerá con su código, su duración y tu nota." },
    { target: "history-list", title: "Tus sesiones", text: "De la más reciente a la más antigua, cada una una sola vez, con su estado en texto: completada o finalizada antes." },
    { target: "history-filter", title: "Filtrar", text: "Muestra todas, solo las completadas o solo las finalizadas antes." },
    { target: "history-detail", title: "Detalle", text: "Añade o edita la nota, reutiliza la configuración en el Tablero o elimina el registro." },
  ],
  ajustes: () => [
    { target: "settings-sound", title: "Sonido", text: "Elige si el tono suena al iniciar, cuál y a qué volumen. Se detiene al pausar, al finalizar o si ocultas la pestaña." },
    { target: "settings-motion", title: "Movimiento", text: "Activa o desactiva la animación de la sesión. Si tu dispositivo pide reducir el movimiento, la figura queda fija." },
    { target: "settings-install", title: "Instalar la app", text: "Ábrela como app, con su icono y sin conexión." },
    { target: "settings-data", title: "Tus datos", text: "Todo se guarda solo en este navegador, sin cuenta. Si borras los datos del sitio, se pierden." },
    { target: "settings-help", title: "Ayuda", text: "Qué es Octava, en una frase. Puedes volver a esta guía cuando quieras desde aquí o desde «Ayuda» en el Tablero." },
  ],
  sesion: () => [
    { target: "session-timer", title: "Tiempo restante", text: "La cuenta atrás y el arco de cobre muestran el avance. La figura de tu código gira despacio." },
    { target: "session-controls", title: "Controles", text: "Pausa y reanuda, finaliza antes (te pedirá confirmación) o silencia el tono." },
    { target: "session-summary", title: "Resumen", text: "La configuración quedó congelada al iniciar: editar un preset no la cambia." },
    { title: "Al terminar", text: "Podrás dejar una nota. La sesión queda en tu historial, solo en este dispositivo." },
  ],
};

let current: Driver | null = null;

export interface StartOptions {
  navigate: (href: string) => void;
  reducedMotion: boolean;
  /** Elemento al que volver el foco al cerrar. */
  returnFocus?: HTMLElement | null;
}

export async function startGuide(id: GuideId, opts: StartOptions): Promise<void> {
  const { driver } = await import("driver.js");
  current?.destroy();

  const steps: DriveStep[] = STEPS[id]()
    .filter((s) => !s.target || tourTarget(s.target))
    .map((s) => ({
      ...(s.target ? { element: () => tourTarget(s.target!) as Element } : {}),
      popover: { title: s.title, description: s.text, ...(s.side ? { side: s.side } : {}) },
    }));
  if (steps.length === 0) return;

  const next = NEXT_SECTION[id];
  const last = steps[steps.length - 1];
  if (next && last.popover) {
    last.popover.doneBtnText = `${next.label} →`;
    last.popover.onNextClick = () => {
      current?.destroy();
      opts.navigate(`${next.href}?${GUIDE_PARAM}=1`);
    };
  }

  current = driver({
    steps,
    animate: !opts.reducedMotion,
    smoothScroll: !opts.reducedMotion,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    closeBtnLabel: "Cerrar la guía",
    popoverClass: "octava-tour",
    overlayColor: "#040506",
    overlayOpacity: 0.72,
    stagePadding: 8,
    stageRadius: 18,
    allowKeyboardControl: true,
    focus: "popover",
    onPopoverRender: (popover: PopoverDOM) => labelPopover(popover),
    onDestroyed: () => {
      current = null;
      const el = opts.returnFocus;
      if (el && document.contains(el)) el.focus();
    },
  });
  current.drive();
}

/** Diálogo accesible: nombre y descripción asociados, y foco en «Siguiente». */
function labelPopover(p: PopoverDOM) {
  p.wrapper.setAttribute("role", "dialog");
  p.wrapper.setAttribute("aria-modal", "false");
  p.title.id = "octava-guia-titulo";
  p.description.id = "octava-guia-texto";
  p.wrapper.setAttribute("aria-labelledby", p.title.id);
  p.wrapper.setAttribute("aria-describedby", p.description.id);
  p.progress.setAttribute("aria-live", "off");
  requestAnimationFrame(() => p.nextButton?.focus());
}

/** Si la URL trae `?guia=1`, quita el parámetro y devuelve `true` para continuar la guía. */
export function consumeGuideParam(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get(GUIDE_PARAM) !== "1") return false;
  url.searchParams.delete(GUIDE_PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + (url.search || "") + url.hash);
  return true;
}
