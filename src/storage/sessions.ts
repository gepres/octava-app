import { isExpired, remainingMs, toPaused, toRecord, toRunning } from "@/domain/timer";
import type { ActiveSession, Draft, PausedSession, PendingNote, RunningSession, SessionConfig, SessionRecord } from "@/domain/types";
import { isValidCode } from "@/domain/code";
import { clampDuration } from "@/domain/types";
import { publish } from "@/sync/channel";
import { newId, openOctavaDB, StorageError } from "./db";

export class ActiveSessionExists extends Error {
  constructor(readonly sessionId: string) {
    super("Ya hay una sesión en curso en este navegador.");
    this.name = "ActiveSessionExists";
  }
}

/** La acción llegó tarde: la sesión ya cambió (otra pestaña, otro clic o vencimiento). */
export class StaleAction extends Error {
  constructor() {
    super("La sesión cambió mientras tanto.");
    this.name = "StaleAction";
  }
}

export class RecordMissing extends Error {
  constructor() {
    super("Este registro ya no existe. Puede que se haya borrado en otra pestaña.");
    this.name = "RecordMissing";
  }
}

export type TransitionResult =
  | { kind: "active"; session: ActiveSession }
  | { kind: "ended"; record: SessionRecord };

export async function getActive(): Promise<ActiveSession | null> {
  const db = await openOctavaDB();
  return (await db.get("active", "current")) ?? null;
}

/**
 * Inicia una sesión a partir del borrador. La imagen del borrador se copia a un id exclusivo
 * de esta sesión dentro de la misma transacción que crea la sesión activa.
 */
export async function startSession(draft: Draft, opts: { soundOn: boolean; now?: number }): Promise<RunningSession> {
  const config = draft.config;
  if (!isValidCode(config.code)) throw new Error("El código debe tener 8 dígitos.");
  const now = opts.now ?? Date.now();
  const id = newId();
  const imageId = draft.image ? newId() : undefined;
  const durationMs = clampDuration(config.durationMin) * 60_000;
  const frozen: SessionConfig = {
    code: config.code,
    durationMin: clampDuration(config.durationMin),
    intention: config.intention.trim(),
    witness: { alias: config.witness.alias.trim(), ...(imageId ? { imageId } : {}) },
    tone: config.tone,
    ...(config.presetId ? { presetId: config.presetId, presetName: config.presetName } : {}),
  };
  const session: RunningSession = {
    key: "current",
    id,
    config: frozen,
    startedAt: now,
    durationMs,
    rev: 1,
    soundOn: opts.soundOn && config.tone !== null,
    updatedAt: now,
    status: "running",
    endsAt: now + durationMs,
    segmentMs: durationMs,
  };

  const db = await openOctavaDB();
  const tx = db.transaction(["active", "images"], "readwrite");
  try {
    const existing = await tx.objectStore("active").get("current");
    if (existing) throw new ActiveSessionExists(existing.id);
    if (draft.image && imageId) {
      const { blob, type, width, height, bytes } = draft.image;
      await tx.objectStore("images").add({ blob, type, width, height, bytes, id: imageId, createdAt: now });
    }
    await tx.objectStore("active").add(session);
    await tx.done;
  } catch (err) {
    abortQuietly(tx);
    await tx.done.catch(() => undefined);
    if (err instanceof ActiveSessionExists) throw err;
    if (isConstraintError(err)) {
      const current = await getActive();
      throw new ActiveSessionExists(current?.id ?? "");
    }
    throw new StorageError("No se pudo iniciar la sesión en el almacenamiento local.", err);
  }
  publish("active");
  return session;
}

type Expect = { id: string; rev: number };

/** Pausa. Si el saldo ya es cero, la sesión se completa («el vencimiento gana»). */
export async function pauseSession(expect: Expect, now?: number): Promise<TransitionResult> {
  return transition(expect, "running", (s, t) => {
    if (s.status !== "running") throw new StaleAction();
    return isExpired(s, t) ? { end: "complete" } : { next: toPaused(s, t) };
  }, now);
}

export async function resumeSession(expect: Expect, now?: number): Promise<TransitionResult> {
  return transition(expect, "paused", (s, t) => {
    if (s.status !== "paused") throw new StaleAction();
    return { next: toRunning(s as PausedSession, t) };
  }, now);
}

/** Finaliza antes del límite. Con saldo cero queda como completada. */
export async function finishEarly(expect: Expect, now?: number): Promise<TransitionResult> {
  return transition(expect, null, () => ({ end: "end-early" }), now);
}

export async function setSessionSound(expect: Expect, soundOn: boolean, now?: number): Promise<TransitionResult> {
  return transition(expect, null, (s, t) => ({ next: { ...s, soundOn, rev: s.rev + 1, updatedAt: t } }), now);
}

type Step = { next: ActiveSession } | { end: "complete" | "end-early" };

async function transition(
  expect: Expect,
  status: ActiveSession["status"] | null,
  step: (s: ActiveSession, now: number) => Step,
  nowOverride?: number,
): Promise<TransitionResult> {
  const db = await openOctavaDB();
  const tx = db.transaction(["active", "history", "kv"], "readwrite");
  let result: TransitionResult;
  try {
    const cur = await tx.objectStore("active").get("current");
    if (!cur || cur.id !== expect.id) {
      const done = await tx.objectStore("history").get(expect.id);
      if (done) {
        await tx.done;
        return { kind: "ended", record: done };
      }
      throw new StaleAction();
    }
    const now = nowOverride ?? Date.now();
    if (cur.rev !== expect.rev) throw new StaleAction();
    if (status && cur.status !== status && !isExpired(cur, now)) throw new StaleAction();
    // El vencimiento gana sobre cualquier acción.
    const s = isExpired(cur, now) ? ({ end: "complete" } as Step) : step(cur, now);
    if ("next" in s) {
      await tx.objectStore("active").put(s.next);
      result = { kind: "active", session: s.next };
    } else {
      const record = toRecord(cur, now, s.end === "complete" ? "complete" : "end-early");
      await tx.objectStore("history").add(record);
      await tx.objectStore("active").delete("current");
      await tx.objectStore("kv").put({ key: "pendingNote", recordId: record.id } satisfies PendingNote);
      result = { kind: "ended", record };
    }
    await tx.done;
  } catch (err) {
    abortQuietly(tx);
    await tx.done.catch(() => undefined);
    if (err instanceof StaleAction) throw err;
    throw new StorageError("No se pudo guardar el cambio de la sesión.", err);
  }
  publish(result.kind === "ended" ? "history" : "active");
  if (result.kind === "ended") publish("active");
  return result;
}

/**
 * Reconciliación: si la sesión activa ya venció, la pasa al historial una sola vez.
 * Seguro de llamar desde varias pestañas a la vez: la transacción serializa y la segunda
 * encuentra el registro ya creado.
 */
export async function reconcileExpired(nowOverride?: number): Promise<SessionRecord | null> {
  const db = await openOctavaDB();
  const tx = db.transaction(["active", "history", "kv"], "readwrite");
  let record: SessionRecord | null = null;
  try {
    const cur = await tx.objectStore("active").get("current");
    const now = nowOverride ?? Date.now();
    if (cur && isExpired(cur, now)) {
      const existing = await tx.objectStore("history").get(cur.id);
      if (existing) {
        record = existing;
      } else {
        record = toRecord(cur, now, "complete");
        await tx.objectStore("history").add(record);
        await tx.objectStore("kv").put({ key: "pendingNote", recordId: record.id } satisfies PendingNote);
      }
      await tx.objectStore("active").delete("current");
    }
    await tx.done;
  } catch (err) {
    abortQuietly(tx);
    await tx.done.catch(() => undefined);
    throw new StorageError("No se pudo guardar la sesión terminada en el historial.", err);
  }
  if (record) {
    publish("history");
    publish("active");
  }
  return record;
}

export async function listHistory(): Promise<SessionRecord[]> {
  const db = await openOctavaDB();
  const all = await db.getAllFromIndex("history", "byEndedAt");
  return all.reverse();
}

export async function getRecord(id: string): Promise<SessionRecord | null> {
  const db = await openOctavaDB();
  return (await db.get("history", id)) ?? null;
}

/** Guarda la nota releyendo el registro dentro de la transacción. No recrea registros borrados. */
export async function saveNote(id: string, note: string, now = Date.now()): Promise<SessionRecord> {
  const db = await openOctavaDB();
  const tx = db.transaction(["history", "kv"], "readwrite");
  let updated: SessionRecord;
  try {
    const rec = await tx.objectStore("history").get(id);
    if (!rec) throw new RecordMissing();
    updated = { ...rec, note: note.trim(), noteUpdatedAt: now };
    await tx.objectStore("history").put(updated);
    const pending = (await tx.objectStore("kv").get("pendingNote")) as PendingNote | undefined;
    if (pending?.recordId === id) await tx.objectStore("kv").delete("pendingNote");
    await tx.done;
  } catch (err) {
    abortQuietly(tx);
    await tx.done.catch(() => undefined);
    if (err instanceof RecordMissing) throw err;
    throw new StorageError("No se pudo guardar la nota.", err);
  }
  publish("history");
  return updated;
}

/** Borra el registro y su imagen (exclusiva de la sesión) en la misma transacción. */
export async function deleteRecord(id: string): Promise<void> {
  const db = await openOctavaDB();
  const tx = db.transaction(["history", "images", "kv"], "readwrite");
  try {
    const rec = await tx.objectStore("history").get(id);
    if (rec) {
      await tx.objectStore("history").delete(id);
      const imageId = rec.config.witness.imageId;
      if (imageId) await tx.objectStore("images").delete(imageId);
    }
    const pending = (await tx.objectStore("kv").get("pendingNote")) as PendingNote | undefined;
    if (pending?.recordId === id) await tx.objectStore("kv").delete("pendingNote");
    await tx.done;
  } catch (err) {
    abortQuietly(tx);
    await tx.done.catch(() => undefined);
    throw new StorageError("No se pudo eliminar el registro.", err);
  }
  publish("history");
}

/** Sesión terminada que espera nota, si sigue existiendo. */
export async function getPendingNote(): Promise<SessionRecord | null> {
  const db = await openOctavaDB();
  const pending = (await db.get("kv", "pendingNote")) as PendingNote | undefined;
  if (!pending) return null;
  return (await db.get("history", pending.recordId)) ?? null;
}

/** La persona omitió la nota de cierre. */
export async function dismissPendingNote(id: string): Promise<void> {
  const db = await openOctavaDB();
  const tx = db.transaction("kv", "readwrite");
  const pending = (await tx.store.get("pendingNote")) as PendingNote | undefined;
  if (pending?.recordId === id) await tx.store.delete("pendingNote");
  await tx.done;
  publish("history");
}

export async function getImageBlob(imageId: string): Promise<Blob | null> {
  const db = await openOctavaDB();
  return (await db.get("images", imageId))?.blob ?? null;
}

export { remainingMs };

function abortQuietly(tx: IDBTransaction | { abort(): void }): void {
  try {
    tx.abort();
  } catch {
    /* ya terminada */
  }
}

function isConstraintError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === "ConstraintError" : (err as { name?: string } | null)?.name === "ConstraintError";
}
