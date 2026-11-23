/**
 * Avisos entre pestañas. El mensaje solo invalida: quien lo recibe vuelve a leer IndexedDB,
 * que es la única fuente de verdad.
 */
export type SyncTopic = "active" | "history" | "presets" | "settings" | "draft";

const CHANNEL = "octava";
type Listener = (topic: SyncTopic) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (ev: MessageEvent<{ topic?: SyncTopic }>) => {
    const topic = ev.data?.topic;
    if (topic) listeners.forEach((l) => l(topic));
  };
  return channel;
}

/** Notifica a esta pestaña y a las demás. Llamar solo después de que la transacción haya terminado. */
export function publish(topic: SyncTopic): void {
  listeners.forEach((l) => l(topic));
  try {
    getChannel()?.postMessage({ topic });
  } catch {
    /* canal cerrado: las demás pestañas releerán al volver a primer plano */
  }
}

export function subscribe(listener: Listener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
