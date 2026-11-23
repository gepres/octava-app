import { describe, expect, it } from "vitest";
import { deletePreset, listPresets, savePreset, validatePreset } from "@/storage/presets";
import { draftFromPreset, draftFromRecord, getDraft, getSettings, saveSettings, updateDraft } from "@/storage/kv";
import { finishEarly, getRecord, startSession } from "@/storage/sessions";
import { checkImageFile, fitWithin, ImageRejected } from "@/media/image";

describe("presets", () => {
  it("siembra tres ejemplos ilustrativos", async () => {
    const list = await listPresets();
    expect(list.map((p) => p.name).sort()).toEqual(["Cierre del día", "Concentración", "Pausa consciente"]);
    expect(list.every((p) => p.example)).toBe(true);
  });

  it("crea, edita y elimina; las sesiones conservan sus valores originales", async () => {
    const p = await savePreset({ name: "Mañana tranquila", code: "00350702", durationMin: 5, tone: 432 });
    await draftFromPreset(p);
    const s = await startSession(await getDraft(), { soundOn: false, now: 1000 });
    const res = await finishEarly({ id: s.id, rev: s.rev }, 2000);
    if (res.kind !== "ended") throw new Error("esperaba registro");

    await savePreset({ name: "Mañana distinta", code: "11111111", durationMin: 20, tone: null }, p.id);
    let rec = await getRecord(res.record.id);
    expect(rec?.config.code).toBe("00350702");
    expect(rec?.config.presetName).toBe("Mañana tranquila");

    await deletePreset(p.id);
    rec = await getRecord(res.record.id);
    expect(rec?.config.durationMin).toBe(5);
    expect((await listPresets()).some((x) => x.id === p.id)).toBe(false);
  });

  it("valida nombre, código y duración", () => {
    expect(validatePreset({ name: "", code: "123", durationMin: 0, tone: null })).toEqual({
      name: expect.any(String), code: expect.any(String), durationMin: expect.any(String),
    });
  });
});

describe("ajustes y borrador", () => {
  it("el sonido parte apagado con volumen bajo", async () => {
    const s = await getSettings();
    expect(s.soundOnStart).toBe(false);
    expect(s.volume).toBeLessThanOrEqual(0.25);
    const next = await saveSettings({ animations: false, tone: 440 });
    expect(next.animations).toBe(false);
    expect((await getSettings()).tone).toBe(440);
  });

  it("el borrador arranca con 5 minutos y aplicar un preset no toca la intención", async () => {
    const d = await getDraft();
    expect(d.config.durationMin).toBe(5);
    await updateDraft({ config: { intention: "Foco" } });
    const [concentracion] = (await listPresets()).filter((p) => p.name === "Concentración");
    const after = await draftFromPreset(concentracion);
    expect(after.config.intention).toBe("Foco");
    expect(after.config.code).toBe("30521470");
    expect(after.config.durationMin).toBe(20);
  });

  it("reutilizar una sesión copia su imagen al borrador", async () => {
    await updateDraft({
      config: { code: "12345678", witness: { alias: "Planta" } },
      image: { blob: new Blob(["x"], { type: "image/png" }), type: "image/png", width: 2, height: 2, bytes: 1, name: "p.png" },
    });
    const s = await startSession(await getDraft(), { soundOn: false, now: 1 });
    await updateDraft({ image: null, config: { code: "00000000", witness: { alias: "" } } });
    const res = await finishEarly({ id: s.id, rev: s.rev }, 2);
    if (res.kind !== "ended") throw new Error("esperaba registro");
    const d = await draftFromRecord(res.record);
    expect(d.config.code).toBe("12345678");
    expect(d.config.witness.alias).toBe("Planta");
    expect(d.config.witness.imageId).toBeUndefined();
    expect(d.image?.type).toBe("image/png");
  });
});

describe("imagen del testigo", () => {
  it("acepta JPEG, PNG y WebP de hasta 5 MiB", () => {
    expect(() => checkImageFile({ type: "image/jpeg", size: 1000 })).not.toThrow();
    expect(() => checkImageFile({ type: "image/webp", size: 5 * 1024 * 1024 })).not.toThrow();
    expect(() => checkImageFile({ type: "image/png", size: 7.2 * 1024 * 1024 })).toThrow(/7,2 MiB/);
    expect(() => checkImageFile({ type: "image/heic", size: 100, name: "IMG.HEIC" })).toThrow(ImageRejected);
    expect(() => checkImageFile({ type: "image/gif", size: 100 })).toThrow(/No es JPEG/);
  });

  it("reduce a 1.024 px por lado como máximo", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1000, 5000)).toEqual({ width: 205, height: 1024 });
  });
});
