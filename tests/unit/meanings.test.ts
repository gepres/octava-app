import { describe, expect, it } from "vitest";
import { openDB } from "idb";
import { intentionLetters, letterValue, proposeCode } from "@/domain/propose";
import { deleteMeaning, getMeaning, listMeanings, saveMeaning, validateMeaning } from "@/storage/meanings";
import { DB_NAME, EXAMPLE_MEANINGS, openOctavaDB } from "@/storage/db";
import { listPresets } from "@/storage/presets";
import { getDraft, updateDraft } from "@/storage/kv";
import { finishEarly, getRecord, startSession } from "@/storage/sessions";

describe("código propuesto desde la intención", () => {
  it("da a cada letra su valor pitagórico", () => {
    expect(["a", "i", "j", "r", "s", "z"].map(letterValue)).toEqual([1, 9, 1, 9, 1, 8]);
  });

  it("ignora tildes, mayúsculas, espacios, cifras y signos", () => {
    expect(intentionLetters("¡Páz y CALMA, 2 veces!")).toBe("pazycalmaveces");
    expect(intentionLetters("Año")).toBe("ano");
    expect(proposeCode("Paz y calma")).toBe(proposeCode("  paz Y CÁLMA!! "));
  });

  it("es determinista y siempre tiene 8 dígitos", () => {
    const intention = "Terminar el informe con calma";
    const code = proposeCode(intention);
    expect(code).toMatch(/^\d{8}$/);
    expect(proposeCode(intention)).toBe(code);
    expect(proposeCode("Terminar el informe con prisa")).not.toBe(code);
  });

  it("reparte las letras por turnos y se queda con la última cifra de cada suma", () => {
    // a+i = 10 → 0, b+j = 3, y el resto una letra por grupo.
    expect(proposeCode("abcdefghij")).toBe("03345678");
    // Con menos de ocho letras se vuelve a empezar: p a z p a z p a.
    expect(proposeCode("paz")).toBe("71871871");
  });

  it("no propone nada sin letras suficientes", () => {
    expect(proposeCode("")).toBeNull();
    expect(proposeCode("¡¡ 12 !!")).toBeNull();
    expect(proposeCode("yo")).toBeNull();
    expect(proposeCode("sol")).not.toBeNull();
  });
});

describe("significados de los códigos", () => {
  it("siembra tres significados de ejemplo para los códigos de los presets de ejemplo", async () => {
    const list = await listMeanings();
    expect(list.map((m) => m.name)).toEqual(["Enfoque", "Pausa", "Soltar"]);
    const presetCodes = (await listPresets()).map((p) => p.code).sort();
    expect(list.map((m) => m.code).sort()).toEqual(presetCodes);
  });

  it("crea, edita conservando la fecha de creación y quita", async () => {
    const created = await saveMeaning("00350702", { name: "  Calma  ", description: " Para empezar despacio. " }, 1000);
    expect(created).toMatchObject({ code: "00350702", name: "Calma", description: "Para empezar despacio.", createdAt: 1000 });

    const edited = await saveMeaning("00350702", { name: "Calma profunda", description: "" }, 2000);
    expect(edited).toMatchObject({ name: "Calma profunda", description: "", createdAt: 1000, updatedAt: 2000 });
    expect((await getMeaning("00350702"))?.name).toBe("Calma profunda");

    await deleteMeaning("00350702");
    expect(await getMeaning("00350702")).toBeUndefined();
    expect((await listMeanings()).map((m) => m.name)).toEqual(["Enfoque", "Pausa", "Soltar"]);
  });

  it("ordena por nombre sin distinguir mayúsculas ni tildes", async () => {
    await saveMeaning("11111111", { name: "ánimo", description: "" });
    await saveMeaning("22222222", { name: "Brújula", description: "" });
    expect((await listMeanings()).map((m) => m.name)).toEqual(["ánimo", "Brújula", "Enfoque", "Pausa", "Soltar"]);
  });

  it("valida nombre, descripción y código", async () => {
    expect(validateMeaning({ name: " ", description: "" })).toEqual({ name: expect.any(String) });
    expect(validateMeaning({ name: "x".repeat(41), description: "y".repeat(201) })).toEqual({
      name: expect.any(String),
      description: expect.any(String),
    });
    await expect(saveMeaning("123", { name: "Corto", description: "" })).rejects.toThrow("8 dígitos");
    await expect(saveMeaning("12345678", { name: "", description: "" })).rejects.toThrow();
    expect(await getMeaning("123")).toBeUndefined();
  });

  it("la sesión congela el nombre del código: cambiarlo después no altera el historial", async () => {
    await updateDraft({ config: { code: "30521470" } });
    const draft = await getDraft();
    const s = await startSession({ ...draft, config: { ...draft.config, codeName: "Enfoque" } }, { soundOn: false, now: 1000 });
    expect(s.config.codeName).toBe("Enfoque");
    const res = await finishEarly({ id: s.id, rev: s.rev }, 2000);
    if (res.kind !== "ended") throw new Error("esperaba registro");

    await saveMeaning("30521470", { name: "Otro nombre", description: "" });
    expect((await getRecord(res.record.id))?.config.codeName).toBe("Enfoque");
  });

  it("una sesión sin significado no guarda nombre de código", async () => {
    await updateDraft({ config: { code: "00000001" } });
    const s = await startSession(await getDraft(), { soundOn: false, now: 1000 });
    expect("codeName" in s.config).toBe(false);
  });
});

describe("migración del esquema", () => {
  it("una base v1 pasa a v2 conservando sus datos y añade los significados de ejemplo", async () => {
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("presets", { keyPath: "id" });
        db.createObjectStore("active", { keyPath: "key" });
        db.createObjectStore("history", { keyPath: "id" }).createIndex("byEndedAt", "endedAt");
        db.createObjectStore("images", { keyPath: "id" });
        db.createObjectStore("kv", { keyPath: "key" });
      },
    });
    await v1.put("presets", { id: "mio", name: "Mío", code: "12345678", durationMin: 7, tone: null, example: false, createdAt: 1, updatedAt: 1 });
    v1.close();

    const db = await openOctavaDB();
    expect(db.version).toBe(2);
    expect(db.objectStoreNames.contains("meanings")).toBe(true);
    expect((await listPresets()).map((p) => p.name)).toEqual(["Mío"]);
    expect((await listMeanings()).map((m) => m.code).sort()).toEqual(EXAMPLE_MEANINGS.map((m) => m.code).sort());
  });
});
