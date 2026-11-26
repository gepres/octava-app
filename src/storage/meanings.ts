import { isValidCode } from "@/domain/code";
import type { CodeMeaning } from "@/domain/types";
import { publish } from "@/sync/channel";
import { openOctavaDB, StorageError } from "./db";

export const MEANING_NAME_MAX = 40;
export const MEANING_DESCRIPTION_MAX = 200;

export interface MeaningInput {
  name: string;
  description: string;
}

export type MeaningValidation = Partial<Record<keyof MeaningInput, string>>;

export function validateMeaning(input: MeaningInput): MeaningValidation {
  const errors: MeaningValidation = {};
  const name = input.name.trim();
  if (!name) errors.name = "Ponle un nombre, por ejemplo «Enfoque».";
  else if (name.length > MEANING_NAME_MAX) errors.name = `Usa ${MEANING_NAME_MAX} caracteres como máximo.`;
  if (input.description.trim().length > MEANING_DESCRIPTION_MAX) {
    errors.description = `Usa ${MEANING_DESCRIPTION_MAX} caracteres como máximo.`;
  }
  return errors;
}

/** Significados ordenados por nombre. */
export async function listMeanings(): Promise<CodeMeaning[]> {
  const db = await openOctavaDB();
  const all = await db.getAll("meanings");
  return all.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }) || a.code.localeCompare(b.code));
}

export async function getMeaning(code: string): Promise<CodeMeaning | undefined> {
  if (!isValidCode(code)) return undefined;
  const db = await openOctavaDB();
  return db.get("meanings", code);
}

/** Crea o actualiza el significado de un código. */
export async function saveMeaning(code: string, input: MeaningInput, now = Date.now()): Promise<CodeMeaning> {
  if (!isValidCode(code)) throw new Error("El código debe tener 8 dígitos.");
  const errors = validateMeaning(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const db = await openOctavaDB();
  const tx = db.transaction("meanings", "readwrite");
  let meaning: CodeMeaning;
  try {
    const prev = await tx.store.get(code);
    meaning = {
      code,
      name: input.name.trim(),
      description: input.description.trim(),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    await tx.store.put(meaning);
    await tx.done;
  } catch (err) {
    try { tx.abort(); } catch { /* terminada */ }
    await tx.done.catch(() => undefined);
    throw new StorageError("No se pudo guardar el significado.", err);
  }
  publish("meanings");
  return meaning;
}

export async function deleteMeaning(code: string): Promise<void> {
  const db = await openOctavaDB();
  try {
    await db.delete("meanings", code);
  } catch (err) {
    throw new StorageError("No se pudo quitar el significado.", err);
  }
  publish("meanings");
}
