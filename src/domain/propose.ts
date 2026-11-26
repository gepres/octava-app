import { CODE_LENGTH } from "./code";

/**
 * Propuesta simbólica de código a partir de la intención.
 *
 * Cada letra vale una cifra, como en la numerología pitagórica (a = 1 … i = 9, j = 1 … r = 9,
 * s = 1 … z = 8). Las letras se reparten por turnos en ocho grupos y cada dígito es la última
 * cifra de la suma de su grupo. Si hay menos de ocho letras, se vuelve a empezar por la primera.
 * La misma intención da siempre el mismo código. No es un cálculo con efecto: es una forma de
 * unir la intención y el código.
 */

/** Letras mínimas para proponer un código. */
export const MIN_PROPOSAL_LETTERS = 3;

/** Letras de la intención en minúsculas, sin tildes, espacios, cifras ni signos: «¡Paz, sí!» → «pazsi». */
export function intentionLetters(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Valor pitagórico de una letra de la «a» a la «z». */
export function letterValue(letter: string): number {
  return ((letter.charCodeAt(0) - 97) % 9) + 1;
}

/** Código de 8 dígitos para esta intención, o `null` si aún no tiene letras suficientes. */
export function proposeCode(intention: string): string | null {
  const letters = intentionLetters(intention);
  if (letters.length < MIN_PROPOSAL_LETTERS) return null;
  const sums = new Array<number>(CODE_LENGTH).fill(0);
  const total = Math.max(CODE_LENGTH, letters.length);
  for (let i = 0; i < total; i++) {
    sums[i % CODE_LENGTH] += letterValue(letters[i % letters.length]);
  }
  return sums.map((s) => s % 10).join("");
}
