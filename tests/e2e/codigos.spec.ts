import { expect, test } from "@playwright/test";
import { setCode, startSession } from "./helpers";

async function expectDials(page: import("@playwright/test").Page, code: string) {
  for (let i = 0; i < 8; i++) {
    await expect(page.getByRole("button", { name: `Dial ${i + 1}, valor ${code[i]}` })).toBeVisible();
  }
}

test.describe("Significado de los códigos", () => {
  test("se da un significado, persiste, se elige en «Mis códigos» y llega a la sesión y al historial", async ({ page }) => {
    await page.goto("/tablero");
    await setCode(page, "00350702");

    await page.getByRole("button", { name: "Darle significado a este código" }).click();
    const dialog = page.getByRole("dialog", { name: "Darle significado" });
    await expect(dialog).toContainText("00350702");
    await dialog.getByLabel("Nombre").fill("Calma");
    await dialog.getByLabel(/Descripción/).fill("Para empezar el día despacio.");
    await dialog.getByRole("button", { name: "Guardar significado" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "significa" })).toContainText("00350702 significa «Calma»");
    const line = page.getByRole("button", { name: /^Editar el significado del código: Calma/ });
    await expect(line).toContainText("Para empezar el día despacio.");

    // Persiste al recargar.
    await page.reload();
    await expect(page.getByRole("button", { name: /^Editar el significado del código: Calma/ })).toBeVisible();

    // «Mis códigos» lista el nuevo y los de ejemplo; elegir uno lo pone en los diales.
    await page.getByRole("button", { name: "Mis códigos" }).click();
    const codes = page.getByRole("dialog", { name: "Mis códigos" });
    await expect(codes.getByRole("button", { name: /^Usar / })).toHaveCount(4);
    await expect(codes).toContainText("En los diales");
    await codes.getByRole("button", { name: "Usar Enfoque, código 30521470" }).click();
    await expect(codes).toBeHidden();
    await expectDials(page, "30521470");
    await expect(page.getByRole("button", { name: /^Editar el significado del código: Enfoque/ })).toBeVisible();

    // El nombre queda congelado en la sesión y en el historial.
    await startSession(page);
    await expect(page.locator("[data-tour=session-summary]")).toContainText("Enfoque");
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
    await expect(page.getByText("Sesión finalizada antes")).toBeVisible();
    await expect(page.getByText(/30521470\s*· Enfoque/)).toBeVisible();
    await page.getByRole("button", { name: "Omitir" }).click();
    await page.goto("/historial");
    await expect(page.getByRole("button", { name: /código 30521470, Enfoque/ })).toBeVisible();
  });

  test("desde «Mis códigos» se edita y se quita un significado, y se vuelve a la lista", async ({ page }) => {
    await page.goto("/tablero");
    await page.getByRole("button", { name: "Mis códigos" }).click();
    const codes = page.getByRole("dialog", { name: "Mis códigos" });
    await codes.getByRole("button", { name: "Editar Pausa" }).click();
    const edit = page.getByRole("dialog", { name: "Significado del código" });
    await expect(edit.getByLabel("Nombre")).toHaveValue("Pausa");
    await edit.getByLabel("Nombre").fill("Respiro");
    await edit.getByRole("button", { name: "Guardar significado" }).click();
    await expect(codes.getByRole("button", { name: "Usar Respiro, código 20406080" })).toBeVisible();

    await codes.getByRole("button", { name: "Editar Respiro" }).click();
    await edit.getByRole("button", { name: "Quitar significado" }).click();
    await expect(codes.getByRole("button", { name: /^Usar / })).toHaveCount(2);
    await codes.getByRole("button", { name: "Cerrar" }).click();
    await expect(page.getByRole("button", { name: "Mis códigos" })).toBeFocused();

    // Los presets muestran el significado vigente.
    await page.goto("/presets");
    await expect(page.getByRole("article").filter({ hasText: "Concentración" })).toContainText("Enfoque");
    await expect(page.getByRole("article").filter({ hasText: "Pausa consciente" })).not.toContainText("Respiro");
  });
});

test.describe("Código propuesto desde la intención", () => {
  test("en escritorio se propone, se usa y su significado parte de la intención", async ({ page }) => {
    await page.goto("/tablero");
    const proposal = page.locator("[data-tour=propose-code]");
    await expect(proposal).toContainText("Escribe tu intención y Octava te propondrá un código.");

    await page.getByLabel("Intención").fill("Paz");
    await expect(proposal).toContainText("71871871");
    await page.getByLabel("Intención").fill("¡paz!");
    await expect(proposal).toContainText("71871871");

    await proposal.getByText("¿Cómo se calcula?").click();
    await expect(proposal).toContainText("numerología pitagórica");

    await proposal.getByRole("button", { name: "Usar el código 71871871" }).click();
    await expectDials(page, "71871871");
    await expect(proposal).toContainText("En los diales");

    await page.getByRole("button", { name: "Darle significado a este código" }).click();
    const dialog = page.getByRole("dialog", { name: "Darle significado" });
    await expect(dialog.getByLabel(/Descripción/)).toHaveValue("¡paz!");
    await dialog.getByLabel("Nombre").fill("Paz");
    await dialog.getByRole("button", { name: "Guardar significado" }).click();
    await expect(page.getByRole("button", { name: /^Editar el significado del código: Paz/ })).toBeVisible();
  });

  test("en móvil se propone desde la hoja de la intención y cabe en 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/tablero");
    // La cabecera del código con «Mis códigos» y «Escribir código» no se desborda.
    await expect(page.locator("[data-tour=meaning]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    await page.locator("[data-tour=intention]").click();
    const sheet = page.getByRole("dialog", { name: "Intención" });
    await sheet.getByLabel("Intención").fill("Terminar el informe con calma");
    const proposal = sheet.locator("[data-tour=propose-code]");
    const code = (await proposal.locator(".tracking-\\[0\\.16em\\]").innerText()).trim();
    expect(code).toMatch(/^\d{8}$/);
    const box = await proposal.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);

    await proposal.getByRole("button", { name: `Usar el código ${code}` }).click();
    await expect(sheet).toBeHidden();
    await expectDials(page, code);
  });
});
