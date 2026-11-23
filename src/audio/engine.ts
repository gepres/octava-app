/**
 * Tono suave y continuo con Web Audio. Los Hz son el tono audible.
 * - El contexto se crea y se reanuda dentro de un gesto de la persona.
 * - Cada activación crea un oscilador nuevo y lleva un token: detener invalida las activaciones pendientes.
 * - El temporizador nunca depende de este módulo.
 */

type Listener = (state: AudioState) => void;
export type AudioState = "off" | "playing" | "blocked" | "unavailable";

const FADE = 0.08;

class ToneEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private token = 0;
  private state: AudioState = "off";
  private listeners = new Set<Listener>();

  get current(): AudioState {
    return this.state;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }

  private set(state: AudioState) {
    if (this.state === state) return;
    this.state = state;
    this.listeners.forEach((l) => l(state));
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!Ctor) {
      this.set("unavailable");
      return null;
    }
    try {
      this.ctx = new Ctor();
    } catch {
      this.set("unavailable");
      return null;
    }
    const ctx = this.ctx;
    ctx.onstatechange = () => {
      if (ctx.state !== "running" && this.state === "playing") {
        this.stopNodes();
        this.set("blocked");
      }
    };
    return this.ctx;
  }

  /** Llamar de forma síncrona dentro del gesto (clic o toque), antes de cualquier espera. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => undefined);
  }

  /** Empieza a sonar. Si el navegador exige un gesto, queda en `blocked` para ofrecer «Activar audio». */
  async play(frequency: number, volume: number): Promise<void> {
    const token = ++this.token;
    this.stopNodes();
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state !== "running") {
      try {
        await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 400))]);
      } catch {
        /* sigue bloqueado */
      }
    }
    if (token !== this.token) return; // se detuvo mientras esperábamos
    if (ctx.state !== "running") {
      this.set("blocked");
      return;
    }
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)) * 0.5, ctx.currentTime + FADE * 4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      this.osc = osc;
      this.gain = gain;
      this.set("playing");
    } catch {
      this.set("unavailable");
    }
  }

  setVolume(volume: number): void {
    if (this.ctx && this.gain) {
      this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.5, this.ctx.currentTime, FADE);
    }
  }

  stop(): void {
    this.token++;
    this.stopNodes();
    if (this.state !== "unavailable") this.set("off");
  }

  private stopNodes(): void {
    const ctx = this.ctx;
    const osc = this.osc;
    const gain = this.gain;
    this.osc = null;
    this.gain = null;
    if (!ctx || !osc || !gain) return;
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 2);
      osc.stop(ctx.currentTime + FADE * 3);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      /* ya detenido */
    }
  }
}

export const toneEngine = new ToneEngine();
