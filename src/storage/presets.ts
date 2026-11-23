import { isValidCode } from "@/domain/code";
import { clampDuration, type Preset, type Tone } from "@/domain/types";
import { publish } from "@/sync/channel";
import { newId, openOctavaDB, StorageError } from "./db";

export interface PresetInput {
  name: string;
  code: string;
  durationMin: number;
  tone: Tone | null;
}

export type PresetValidation = Partial<Record<keyof PresetInput, string>>;

export function validatePreset(input: PresetInput): PresetValidation {
  const errors: PresetValidation = {};
  if (!input.name.trim()) errors.name = "Ponle un nombre al preset.";
  else if (input.name.trim().length > 60) errors.name = "Usa 60 caracteres como máximo.";
  if (!isValidCode(input.code)) errors.code = "El código debe tener 8 dígitos.";
  if (!Number.isFinite(input.durationMin) || input.durationMin < 1 || input.durationMin > 60) {
    errors.durationMin = "La duración va de 1 a 60 minutos.";
  }
  return errors;
}

export async function listPresets(): Promise<Preset[]> {
  const db = await openOctavaDB();
  const all = await db.getAll("presets");
  // Primero los propios (más recientes arriba) y después los ejemplos.
  return all.sort((a, b) => Number(a.example) - Number(b.example) || b.updatedAt - a.updatedAt);
}

export async function savePreset(input: PresetInput, id?: string, now = Date.now()): Promise<Preset> {
  const errors = validatePreset(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const db = await openOctavaDB();
  const tx = db.transaction("presets", "readwrite");
  let preset: Preset;
  try {
    const prev = id ? await tx.store.get(id) : undefined;
    preset = {
      id: prev?.id ?? newId(),
      name: input.name.trim(),
      code: input.code,
      durationMin: clampDuration(input.durationMin),
      tone: input.tone,
      example: prev?.example ?? false,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    await tx.store.put(preset);
    await tx.done;
  } catch (err) {
    try { tx.abort(); } catch { /* terminada */ }
    await tx.done.catch(() => undefined);
    throw new StorageError("No se pudo guardar el preset.", err);
  }
  publish("presets");
  return preset;
}

export async function deletePreset(id: string): Promise<void> {
  const db = await openOctavaDB();
  try {
    await db.delete("presets", id);
  } catch (err) {
    throw new StorageError("No se pudo eliminar el preset.", err);
  }
  publish("presets");
}
