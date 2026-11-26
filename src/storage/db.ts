import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ActiveSession, CodeMeaning, Draft, PendingNote, Preset, SessionRecord, Settings, StoredImage } from "@/domain/types";

export const DB_NAME = "octava";
/** Versión del esquema. Cada cambio de estructura sube este número y añade su migración. */
export const DB_VERSION = 2;

export interface OctavaDB extends DBSchema {
  presets: { key: string; value: Preset };
  active: { key: "current"; value: ActiveSession };
  history: { key: string; value: SessionRecord; indexes: { byEndedAt: number } };
  images: { key: string; value: StoredImage };
  kv: { key: string; value: Settings | Draft | PendingNote };
  /** v2: lo que cada código significa para la persona, con el código como clave. */
  meanings: { key: string; value: CodeMeaning };
}

export type OctavaDatabase = IDBPDatabase<OctavaDB>;

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

/** Presets de ejemplo. Los códigos son ilustrativos. */
export const EXAMPLE_PRESETS: ReadonlyArray<Pick<Preset, "id" | "name" | "code" | "durationMin" | "tone">> = [
  { id: "ejemplo-concentracion", name: "Concentración", code: "30521470", durationMin: 20, tone: 440 },
  { id: "ejemplo-pausa-consciente", name: "Pausa consciente", code: "20406080", durationMin: 5, tone: null },
  { id: "ejemplo-cierre-del-dia", name: "Cierre del día", code: "90817263", durationMin: 10, tone: 220 },
];

/** Significados de ejemplo para los códigos de los presets de ejemplo. La persona puede cambiarlos. */
export const EXAMPLE_MEANINGS: ReadonlyArray<Pick<CodeMeaning, "code" | "name" | "description">> = [
  { code: "30521470", name: "Enfoque", description: "Para estudiar o trabajar sin distracciones." },
  { code: "20406080", name: "Pausa", description: "Parar un momento entre tareas y respirar." },
  { code: "90817263", name: "Soltar", description: "Cerrar la jornada y dejar ir lo pendiente." },
];

let dbPromise: Promise<OctavaDatabase> | null = null;

export function openOctavaDB(): Promise<OctavaDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<OctavaDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore("presets", { keyPath: "id" });
          db.createObjectStore("active", { keyPath: "key" });
          const history = db.createObjectStore("history", { keyPath: "id" });
          history.createIndex("byEndedAt", "endedAt");
          db.createObjectStore("images", { keyPath: "id" });
          db.createObjectStore("kv", { keyPath: "key" });
          const now = Date.now();
          const presets = tx.objectStore("presets");
          EXAMPLE_PRESETS.forEach((p, i) => {
            void presets.add({ ...p, example: true, createdAt: now - i, updatedAt: now - i });
          });
        }
        if (oldVersion < 2) {
          db.createObjectStore("meanings", { keyPath: "code" });
          const now = Date.now();
          const meanings = tx.objectStore("meanings");
          EXAMPLE_MEANINGS.forEach((m) => {
            void meanings.add({ ...m, createdAt: now, updatedAt: now });
          });
        }
      },
      blocking() {
        // Otra pestaña necesita una versión nueva del esquema: cerramos para no bloquearla.
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((err: unknown) => {
      dbPromise = null;
      throw new StorageError("No se pudo abrir el almacenamiento local de este navegador.", err);
    });
  }
  return dbPromise;
}

/** Solo para pruebas: olvida la conexión abierta. */
export async function resetDBForTests(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* sin conexión previa */
    }
  }
  dbPromise = null;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
