import { describe, expect, it } from "vitest";
import { codeToDials, dialsToCode, isValidCode, parseCodeInput } from "@/domain/code";

describe("código de ocho dígitos", () => {
  it("conserva los ceros iniciales en ambos sentidos", () => {
    expect(codeToDials("00350702")).toEqual([0, 0, 3, 5, 0, 7, 0, 2]);
    expect(dialsToCode([0, 0, 3, 5, 0, 7, 0, 2])).toBe("00350702");
  });

  it("acepta pegar con espacios o guiones", () => {
    expect(parseCodeInput("0035 0702")).toEqual({ ok: true, code: "00350702" });
    expect(parseCodeInput("0035-0702")).toEqual({ ok: true, code: "00350702" });
  });

  it("explica las entradas inválidas", () => {
    expect(parseCodeInput("00350")).toMatchObject({ ok: false, error: "Faltan 3 dígitos." });
    expect(parseCodeInput("0035070")).toMatchObject({ ok: false, error: "Faltan 1 dígito." });
    expect(parseCodeInput("0035a702")).toMatchObject({ ok: false, error: "Solo dígitos del 0 al 9." });
    expect(parseCodeInput("")).toMatchObject({ ok: false, error: "Escribe los 8 dígitos del código." });
    expect(parseCodeInput("0035070299")).toMatchObject({ ok: false });
  });

  it("valida el formato", () => {
    expect(isValidCode("00350702")).toBe(true);
    expect(isValidCode("0035070")).toBe(false);
    expect(isValidCode("0035070a")).toBe(false);
  });

  it("acota los diales a 0–9", () => {
    expect(dialsToCode([-2, 12, 3.4, 0, 0, 0, 0, 9])).toBe("09300009");
  });
});
