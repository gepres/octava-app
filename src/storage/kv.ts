import { DEFAULT_SETTINGS, emptyDraft, isTone, type Draft, type ImageData, type Preset, type SessionConfig, type SessionRecord, type Settings, type Tone } from "@/domain/types";
import { publish } from "@/sync/channel";
import { openOctavaDB, StorageError } from "./db";

export async function getSettings(): Promise<Settings> {
  const db = await openOctavaDB();
  const s = (await db.get("kv", "settings")) as Settings | undefined;
  return normalizeSettings(s);
}

export async function saveSettings(patch: Partial<Omit<Settings, "key">>): Promise<Settings> {
  const db = await openOctavaDB();
  const tx = db.transaction("kv", "readwrite");
  let next: Settings;
  try {
    const cur = normalizeSettings((await tx.store.get("settings")) as Settings | undefined);
    next = normalizeSettings({ ...cur, ...patch, key: "settings" });
    await tx.store.put(next);
    await tx.done;
  } catch (err) {
    try { tx.abort(); } catch { /* terminada */ }
    await tx.done.catch(() => undefined);
    throw new StorageError("No se pudieron guardar los ajustes.", err);
  }
  publish("settings");
  return next;
}

function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  return {
    key: "settings",
    soundOnStart: typeof s?.soundOnStart === "boolean" ? s.soundOnStart : DEFAULT_SETTINGS.soundOnStart,
    tone: isTone(s?.tone) ? s.tone : DEFAULT_SETTINGS.tone,
    volume: typeof s?.volume === "number" && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULT_SETTINGS.volume,
    animations: typeof s?.animations === "boolean" ? s.animations : DEFAULT_SETTINGS.animations,
  };
}

export async function getDraft(): Promise<Draft> {
  const db = await openOctavaDB();
  const d = (await db.get("kv", "draft")) as Draft | undefined;
  if (d) return { ...d, toneFromSettings: d.toneFromSettings ?? false };
  return emptyDraft();
}

/**
 * Tono efectivo del borrador. Mientras la persona no elija el sonido en el Tablero
 * (ni lo fije un preset o una sesión reutilizada), manda «Sonido al iniciar» de Ajustes.
 */
export function effectiveTone(draft: Draft, settings: Settings | undefined): Tone | null {
  if (!draft.toneFromSettings) return draft.config.tone;
  const s = settings ?? DEFAULT_SETTINGS;
  return s.soundOnStart ? s.tone : null;
}

/** Carga en el borrador la configuración de una sesión pasada, con una copia de su imagen. */
export async function draftFromRecord(rec: SessionRecord): Promise<Draft> {
  const db = await openOctavaDB();
  const imageId = rec.config.witness.imageId;
  const img = imageId ? await db.get("images", imageId) : undefined;
  return updateDraft({
    config: {
      code: rec.config.code,
      durationMin: rec.config.durationMin,
      intention: rec.config.intention,
      tone: rec.config.tone,
      witness: { alias: rec.config.witness.alias },
      presetId: undefined,
      presetName: undefined,
    },
    toneFromSettings: false,
    image: img ? { blob: img.blob, type: img.type, width: img.width, height: img.height, bytes: img.bytes, name: rec.config.witness.alias || "testigo" } : null,
  });
}

/** Aplica un preset: carga código, duración y tono sin tocar intención ni testigo. */
export async function draftFromPreset(p: Preset): Promise<Draft> {
  return updateDraft({ config: { code: p.code, durationMin: p.durationMin, tone: p.tone, presetId: p.id, presetName: p.name }, toneFromSettings: false });
}

/** Cambios de un borrador. Solo lleva los campos que la persona tocó. */
export interface DraftPatch {
  config?: Partial<SessionConfig>;
  image?: (ImageData & { name: string }) | null;
  toneFromSettings?: boolean;
}

/** Junta dos parches: los campos del segundo ganan. */
export function mergeDraftPatch(a: DraftPatch | null, b: DraftPatch | null): DraftPatch | null {
  if (!a) return b;
  if (!b) return a;
  const config = a.config || b.config ? { ...a.config, ...b.config } : undefined;
  if (config && (a.config?.witness || b.config?.witness)) {
    config.witness = { ...a.config?.witness, ...b.config?.witness } as SessionConfig["witness"];
  }
  return {
    ...(config ? { config } : {}),
    ...(b.image !== undefined ? { image: b.image } : a.image !== undefined ? { image: a.image } : {}),
    ...(b.toneFromSettings !== undefined ? { toneFromSettings: b.toneFromSettings } : a.toneFromSettings !== undefined ? { toneFromSettings: a.toneFromSettings } : {}),
  };
}

/** Aplica un parche sobre un borrador (en memoria). */
export function applyDraftPatch(d: Draft, p: DraftPatch | null): Draft {
  if (!p) return d;
  return {
    ...d,
    config: { ...d.config, ...p.config, witness: { ...d.config.witness, ...p.config?.witness } },
    image: p.image === undefined ? d.image : p.image,
    toneFromSettings: p.toneFromSettings ?? d.toneFromSettings,
  };
}

/** Actualiza el borrador releyéndolo dentro de la transacción: solo cambian los campos del parche. */
export async function updateDraft(patch: DraftPatch, now = Date.now()): Promise<Draft> {
  const db = await openOctavaDB();
  const tx = db.transaction("kv", "readwrite");
  let next: Draft;
  try {
    const stored = (await tx.store.get("draft")) as Draft | undefined;
    const cur = stored ? { ...stored, toneFromSettings: stored.toneFromSettings ?? false } : emptyDraft(now);
    next = { ...applyDraftPatch(cur, patch), key: "draft", updatedAt: now };
    // El borrador nunca apunta a imágenes de sesiones: su imagen va dentro.
    delete next.config.witness.imageId;
    await tx.store.put(next);
    await tx.done;
  } catch (err) {
    try { tx.abort(); } catch { /* terminada */ }
    await tx.done.catch(() => undefined);
    throw new StorageError("No se pudo guardar el borrador del Tablero.", err);
  }
  publish("draft");
  return next;
}
