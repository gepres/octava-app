/** Código del tablero: ocho dígitos del 0 al 9, con ceros iniciales. */

export const CODE_LENGTH = 8;
export const DIAL_MIN = 0;
export const DIAL_MAX = 9;

export type Dials = readonly number[];

export function clampDial(value: number): number {
  if (!Number.isFinite(value)) return DIAL_MIN;
  return Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(value)));
}

export function dialsToCode(dials: Dials): string {
  return dials.map((d) => String(clampDial(d))).join("");
}

export function codeToDials(code: string): number[] {
  return code.split("").map((ch) => Number(ch));
}

export function isValidCode(code: string): boolean {
  return /^\d{8}$/.test(code);
}

export type CodeParse =
  | { ok: true; code: string }
  | { ok: false; partial: string; error: string };

/**
 * Interpreta lo que la persona escribe o pega en el campo del código.
 * Acepta espacios y guiones como separadores (por ejemplo «0035 0702»).
 */
export function parseCodeInput(raw: string): CodeParse {
  const clean = raw.replace(/[\s-]/g, "");
  if (!/^\d*$/.test(clean)) {
    return { ok: false, partial: clean, error: "Solo dígitos del 0 al 9." };
  }
  if (clean.length > CODE_LENGTH) {
    return { ok: false, partial: clean, error: `El código tiene ${CODE_LENGTH} dígitos; sobran ${clean.length - CODE_LENGTH}.` };
  }
  if (clean.length === 0) {
    return { ok: false, partial: clean, error: `Escribe los ${CODE_LENGTH} dígitos del código.` };
  }
  if (clean.length < CODE_LENGTH) {
    const missing = CODE_LENGTH - clean.length;
    return { ok: false, partial: clean, error: `Faltan ${missing} ${missing === 1 ? "dígito" : "dígitos"}.` };
  }
  return { ok: true, code: clean };
}

/** Puntos de la figura de ocho radios: la distancia al centro es el valor de cada dial. */
export function codeFigurePoints(code: string, cx: number, cy: number, rMin: number, rStep: number): string {
  return codeToDials(code)
    .map((v, i) => {
      const a = ((-90 + i * 45) * Math.PI) / 180;
      const r = rMin + v * rStep;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
}
