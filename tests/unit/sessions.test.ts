import { describe, expect, it, vi } from "vitest";
import { emptyDraft, type Draft } from "@/domain/types";
import { openOctavaDB } from "@/storage/db";
import {
  ActiveSessionExists,
  StaleAction,
  deleteRecord,
  finishEarly,
  getActive,
  getRecord,
  listHistory,
  pauseSession,
  reconcileExpired,
  resumeSession,
  saveNote,
  startSession,
} from "@/storage/sessions";
import { StorageError } from "@/storage/db";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

function draft(withImage = false): Draft {
  const d = emptyDraft(T0);
  d.config.code = "00350702";
  d.config.intention = "Sostener la calma";
  d.config.witness.alias = "Mi jardín";
  if (withImage) {
    d.image = { blob: new Blob(["img"], { type: "image/jpeg" }), type: "image/jpeg", width: 10, height: 10, bytes: 3, name: "jardin.jpg" };
  }
  return d;
}

describe("sesión activa única y registro único", () => {
  it("congela la configuración e impide un segundo inicio", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    expect(s.config.code).toBe("00350702");
    expect(s.endsAt).toBe(T0 + 5 * MIN);
    await expect(startSession(draft(), { soundOn: false, now: T0 + 1 })).rejects.toBeInstanceOf(ActiveSessionExists);
  });

  it("dos inicios simultáneos dejan una sola sesión activa", async () => {
    const results = await Promise.allSettled([
      startSession(draft(), { soundOn: false, now: T0 }),
      startSession(draft(), { soundOn: false, now: T0 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  it("pausar, recargar y reanudar conserva el restante", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const paused = await pauseSession({ id: s.id, rev: s.rev }, T0 + 2 * MIN);
    expect(paused.kind).toBe("active");
    // «Recarga»: se lee de nuevo de IndexedDB.
    const again = await getActive();
    expect(again?.status).toBe("paused");
    expect(again && again.status === "paused" ? again.remainingMs : -1).toBe(3 * MIN);
    const resumed = await resumeSession({ id: s.id, rev: again!.rev }, T0 + 40 * MIN);
    expect(resumed.kind === "active" && resumed.session.status === "running" ? resumed.session.endsAt : 0).toBe(T0 + 43 * MIN);
  });

  it("rechaza acciones con una revisión antigua", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    await pauseSession({ id: s.id, rev: s.rev }, T0 + MIN);
    await expect(pauseSession({ id: s.id, rev: s.rev }, T0 + MIN + 1)).rejects.toBeInstanceOf(StaleAction);
  });

  it("al vencer, varias reconciliaciones simultáneas crean un solo registro", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const late = s.endsAt + 3 * 60 * MIN;
    const [a, b, c] = await Promise.all([reconcileExpired(late), reconcileExpired(late), reconcileExpired(late)]);
    const records = await listHistory();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("completed");
    expect(records[0].endedAt).toBe(s.endsAt);
    expect([a, b, c].filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(await getActive()).toBeNull();
  });

  it("pausar con el saldo en cero completa la sesión (el vencimiento gana)", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const res = await pauseSession({ id: s.id, rev: s.rev }, s.endsAt);
    expect(res.kind).toBe("ended");
    expect(res.kind === "ended" && res.record.status).toBe("completed");
  });

  it("finalizar antes guarda un estado distinguible y admite nota", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const res = await finishEarly({ id: s.id, rev: s.rev }, T0 + 108_000);
    expect(res.kind).toBe("ended");
    if (res.kind !== "ended") return;
    expect(res.record.status).toBe("ended-early");
    expect(res.record.elapsedMs).toBe(108_000);
    await saveNote(res.record.id, "  La terminé antes.  ");
    expect((await getRecord(res.record.id))?.note).toBe("La terminé antes.");
  });

  it("finalizar dos veces (doble toque) devuelve el mismo registro", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const [a, b] = await Promise.all([
      finishEarly({ id: s.id, rev: s.rev }, T0 + MIN),
      finishEarly({ id: s.id, rev: s.rev }, T0 + MIN),
    ]);
    expect(a.kind).toBe("ended");
    expect(b.kind).toBe("ended");
    expect(await listHistory()).toHaveLength(1);
  });

  it("si el guardado en el historial falla, la sesión sigue activa y el reintento guarda una sola fila", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const proto = Object.getPrototypeOf((await openOctavaDB()).transaction("history").store) as { add: (...a: unknown[]) => unknown };
    const original = proto.add;
    const spy = vi.spyOn(proto, "add").mockImplementationOnce(function (this: unknown) {
      throw new DOMException("Sin espacio", "QuotaExceededError");
    });
    await expect(reconcileExpired(s.endsAt + 1)).rejects.toBeInstanceOf(StorageError);
    expect(await getActive()).not.toBeNull();
    expect(await listHistory()).toHaveLength(0);
    spy.mockRestore();
    expect(proto.add).toBe(original);
    await reconcileExpired(s.endsAt + 2);
    expect(await listHistory()).toHaveLength(1);
    expect(await getActive()).toBeNull();
  });

  it("la imagen del testigo es exclusiva de la sesión y se borra con su registro", async () => {
    const s = await startSession(draft(true), { soundOn: false, now: T0 });
    const imageId = s.config.witness.imageId!;
    const db = await openOctavaDB();
    expect(await db.get("images", imageId)).toBeTruthy();
    const res = await finishEarly({ id: s.id, rev: s.rev }, T0 + MIN);
    if (res.kind !== "ended") throw new Error("esperaba registro");
    await deleteRecord(res.record.id);
    expect(await db.get("images", imageId)).toBeUndefined();
    expect(await listHistory()).toHaveLength(0);
  });

  it("guardar la nota de un registro borrado no lo recrea", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const res = await finishEarly({ id: s.id, rev: s.rev }, T0 + MIN);
    if (res.kind !== "ended") throw new Error("esperaba registro");
    await deleteRecord(res.record.id);
    await expect(saveNote(res.record.id, "hola")).rejects.toThrow();
    expect(await listHistory()).toHaveLength(0);
  });

  it("el historial se ordena del más reciente al más antiguo", async () => {
    for (let i = 0; i < 3; i++) {
      const s = await startSession(draft(), { soundOn: false, now: T0 + i * 10 * MIN });
      await finishEarly({ id: s.id, rev: s.rev }, T0 + i * 10 * MIN + MIN);
    }
    const list = await listHistory();
    expect(list.map((r) => r.endedAt)).toEqual([T0 + 21 * MIN, T0 + 11 * MIN, T0 + MIN]);
  });
});
