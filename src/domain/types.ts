/** Modelos de datos de Octava. Todo vive en IndexedDB, en este navegador. */

export const TONES = [220, 432, 440] as const;
export type Tone = (typeof TONES)[number];

export const MIN_DURATION = 1;
export const MAX_DURATION = 60;
export const DEFAULT_DURATION = 5;

export interface Witness {
  alias: string;
  /** Imagen exclusiva de la sesión, en el store `images`. Solo en sesiones activas e historial. */
  imageId?: string;
}

/** Configuración de una sesión, congelada al iniciar. */
export interface SessionConfig {
  code: string;
  durationMin: number;
  intention: string;
  witness: Witness;
  /** Tono elegido para la sesión, o `null` si va sin sonido. */
  tone: Tone | null;
  presetId?: string;
  presetName?: string;
  /** Nombre que la persona dio al código, congelado al iniciar. Solo en sesiones e historial. */
  codeName?: string;
}

/** Lo que un código significa para la persona: lo decide ella. Clave = el código. */
export interface CodeMeaning {
  code: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

/** Configuración reutilizable. No incluye intención ni testigo. */
export interface Preset {
  id: string;
  name: string;
  code: string;
  durationMin: number;
  tone: Tone | null;
  example: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ActiveBase {
  key: "current";
  id: string;
  config: SessionConfig;
  startedAt: number;
  durationMs: number;
  /** Se incrementa en cada acción de la persona; protege de clics atrasados. */
  rev: number;
  /** Si la sesión lleva el sonido encendido. */
  soundOn: boolean;
  updatedAt: number;
}

export interface RunningSession extends ActiveBase {
  status: "running";
  /** Marca de fin (epoch ms). */
  endsAt: number;
  /** Saldo al empezar este tramo: acota el restante ante saltos del reloj. */
  segmentMs: number;
}

export interface PausedSession extends ActiveBase {
  status: "paused";
  /** Tiempo restante guardado al pausar. */
  remainingMs: number;
}

export type ActiveSession = RunningSession | PausedSession;

export type RecordStatus = "completed" | "ended-early";

export interface SessionRecord {
  id: string;
  config: SessionConfig;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  elapsedMs: number;
  status: RecordStatus;
  note: string;
  noteUpdatedAt: number | null;
}

export interface ImageData {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  bytes: number;
}

export interface StoredImage extends ImageData {
  id: string;
  createdAt: number;
}

export interface Settings {
  key: "settings";
  soundOnStart: boolean;
  tone: Tone;
  /** 0 a 1. */
  volume: number;
  animations: boolean;
}

/** Borrador del Tablero: lo que la persona está preparando. La imagen va dentro, ya reducida. */
export interface Draft {
  key: "draft";
  config: SessionConfig;
  image: (ImageData & { name: string }) | null;
  /** El sonido aún sigue «Sonido al iniciar» de Ajustes (nadie lo eligió en el Tablero). */
  toneFromSettings: boolean;
  updatedAt: number;
}

/** Sesión terminada que espera la nota de cierre (o que la persona la omita). */
export interface PendingNote {
  key: "pendingNote";
  recordId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  key: "settings",
  soundOnStart: false,
  tone: 432,
  volume: 0.2,
  animations: true,
};

export function emptyConfig(): SessionConfig {
  return {
    code: "00000000",
    durationMin: DEFAULT_DURATION,
    intention: "",
    witness: { alias: "" },
    tone: null,
  };
}

export function emptyDraft(now = Date.now()): Draft {
  return { key: "draft", config: emptyConfig(), image: null, toneFromSettings: true, updatedAt: now };
}

export function clampDuration(min: number): number {
  if (!Number.isFinite(min)) return DEFAULT_DURATION;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(min)));
}

export function isTone(v: unknown): v is Tone {
  return v === 220 || v === 432 || v === 440;
}
