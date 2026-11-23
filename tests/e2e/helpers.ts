import { expect, type Page } from "@playwright/test";

/** Lee un store de IndexedDB de la app (fuente de verdad) desde la página. */
export async function countStore(page: Page, store: "history" | "active" | "presets" | "images"): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("octava");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(name, "readonly");
          const c = tx.objectStore(name).count();
          c.onsuccess = () => {
            resolve(c.result);
            db.close();
          };
          c.onerror = () => reject(c.error);
        };
      }),
    store,
  );
}

export async function setCode(page: Page, code: string) {
  await page.getByRole("button", { name: "Escribir código" }).click();
  const input = page.getByLabel("Código de 8 dígitos");
  await input.fill(code);
  await page.getByRole("button", { name: "Listo" }).first().click();
}

export async function setDuration(page: Page, minutes: number) {
  const value = page.locator("output").first();
  for (let i = 0; i < 70; i++) {
    const current = Number((await value.innerText()).replace(/\D/g, ""));
    if (current === minutes) return;
    await page.getByRole("button", { name: current > minutes ? "Restar un minuto" : "Sumar un minuto" }).click();
  }
  throw new Error("No se pudo ajustar la duración");
}

export async function startSession(page: Page) {
  await page.getByRole("button", { name: /^Iniciar sesión/ }).click();
  await page.waitForURL("**/sesion");
  await expect(page.getByRole("timer")).toBeVisible();
}

export async function timerText(page: Page): Promise<string> {
  return (await page.getByRole("timer").getAttribute("aria-label")) ?? "";
}
