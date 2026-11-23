import { describe, expect, it } from "vitest";
import { remainingMs } from "@/domain/timer";
import { DEFAULT_SETTINGS, emptyDraft, type Draft } from "@/domain/types";
import { applyDraftPatch, draftFromPreset, effectiveTone, getDraft, mergeDraftPatch, updateDraft } from "@/storage/kv";
import { listPresets } from "@/storage/presets";
import { NoteConflict, finishEarly, getActive, rebaseRunning, saveNote, startSession } from "@/storage/sessions";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

function draft(): Draft {
  const d = emptyDraft(T0);
  d.config.code = "00350702";
  return d;
}

describe("hallazgos de la revisión posterior", () => {
  it("una nota cambiada en otra pestaña no se pisa sin avisar", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    const res = await finishEarly({ id: s.id, rev: s.rev }, T0 + MIN);
    if (res.kind !== "ended") throw new Error("esperaba registro");
    // Pestaña B guarda primero.
    await saveNote(res.record.id, "Desde B", { expected: "" });
    // Pestaña A guarda con la versión que tenía abierta.
    await expect(saveNote(res.record.id, "Desde A", { expected: "" })).rejects.toBeInstanceOf(NoteConflict);
    // Tras ver el conflicto, A puede reemplazarla de forma consciente.
    const ok = await saveNote(res.record.id, "Desde A", { expected: "Desde B" });
    expect(ok.note).toBe("Desde A");
  });

  it("un retroceso del reloj no alarga la sesión: se ancla al restante monotónico", async () => {
    const s = await startSession(draft(), { soundOn: false, now: T0 });
    // Pasaron 2 min reales; el reloj del sistema retrocede 10 min.
    const back = T0 + 2 * MIN - 10 * MIN;
    expect(remainingMs(s, back)).toBe(5 * MIN); // sin anclar, se quedaría en 5 min
    await rebaseRunning({ id: s.id, rev: s.rev }, 3 * MIN, back);
    const cur = await getActive();
    expect(cur && remainingMs(cur, back)).toBe(3 * MIN);
    expect(cur && remainingMs(cur, back + 3 * MIN)).toBe(0);
    expect(cur?.rev).toBe(s.rev);
  });

  it("el borrador se actualiza por campos: un preset aplicado en otra pestaña no se pisa", async () => {
    await updateDraft({ config: { intention: "Foco" } });
    // Pestaña B aplica un preset.
    const [concentracion] = (await listPresets()).filter((p) => p.name === "Concentración");
    await draftFromPreset(concentracion);
    // Pestaña A solo cambió la intención: su parche no lleva código ni duración.
    await updateDraft({ config: { intention: "Calma" } });
    const d = await getDraft();
    expect(d.config.code).toBe("30521470");
    expect(d.config.durationMin).toBe(20);
    expect(d.config.intention).toBe("Calma");
  });

  it("los parches pendientes se combinan y se reaplican sobre la versión nueva", () => {
    const p = mergeDraftPatch({ config: { intention: "a", witness: { alias: "x" } } }, { config: { durationMin: 9 } });
    const base = draft();
    base.config.code = "11111111";
    const out = applyDraftPatch(base, p);
    expect(out.config).toMatchObject({ code: "11111111", intention: "a", durationMin: 9, witness: { alias: "x" } });
  });

  it("«Sonido al iniciar» manda mientras nadie elija el sonido en el Tablero", async () => {
    const d = await getDraft();
    expect(d.toneFromSettings).toBe(true);
    expect(effectiveTone(d, { ...DEFAULT_SETTINGS, soundOnStart: true, tone: 440 })).toBe(440);
    expect(effectiveTone(d, { ...DEFAULT_SETTINGS, soundOnStart: false })).toBeNull();
    const chosen = await updateDraft({ config: { tone: null }, toneFromSettings: false });
    expect(effectiveTone(chosen, { ...DEFAULT_SETTINGS, soundOnStart: true })).toBeNull();
  });
});
