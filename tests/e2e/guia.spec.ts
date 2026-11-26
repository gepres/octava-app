import { expect, test, type Page } from "@playwright/test";
import { setCode, startSession } from "./helpers";

const popover = (page: Page) => page.locator(".driver-popover.octava-tour");
const title = (page: Page) => popover(page).locator(".driver-popover-title");

/** Pulsa «Siguiente» hasta que aparezca el botón indicado (o el de «Listo»). */
async function nextUntil(page: Page, finalLabel: RegExp, max = 20) {
  for (let i = 0; i < max; i++) {
    const next = popover(page).locator(".driver-popover-next-btn");
    await expect(next).toBeVisible();
    if (finalLabel.test((await next.innerText()).trim())) return next;
    await next.click();
  }
  throw new Error("No se llegó al último paso");
}

test.describe("Guía de uso", () => {
  test("recorre Tablero → Presets → Historial → Ajustes desde «Ayuda»", async ({ page }) => {
    await page.goto("/tablero");
    await page.getByRole("button", { name: "Ayuda" }).click();
    await page.getByRole("button", { name: "Ver la guía paso a paso" }).click();
    await expect(title(page)).toHaveText("Así se usa Octava");
    await expect(popover(page)).toHaveAttribute("role", "dialog");
    await expect(popover(page).locator(".driver-popover-next-btn")).toBeFocused();
    await expect(popover(page).locator(".driver-popover-progress-text")).toHaveText(/^1 de \d+$/);

    await (await nextUntil(page, /Seguir en Presets/)).click();
    await page.waitForURL("**/presets");
    await expect(title(page)).toHaveText("Un preset");

    await (await nextUntil(page, /Seguir en Historial/)).click();
    await page.waitForURL("**/historial");
    await expect(title(page)).toHaveText("Aquí aparecerán tus sesiones");

    await (await nextUntil(page, /Seguir en Ajustes/)).click();
    await page.waitForURL("**/ajustes");
    await expect(title(page)).toHaveText("Sonido");
    await (await nextUntil(page, /^Listo$/)).click();
    await expect(popover(page)).toHaveCount(0);
    expect(page.url()).not.toContain("guia=");
  });

  test("en móvil cada paso cabe en la pantalla y Escape cierra la guía", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/ajustes");
    await page.getByRole("button", { name: "Recorrer la guía de uso" }).click();
    await page.waitForURL((u) => u.pathname === "/tablero");
    await expect(title(page)).toHaveText("Así se usa Octava");
    for (let i = 0; i < 16; i++) {
      const box = await popover(page).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
      const next = popover(page).locator(".driver-popover-next-btn");
      if (/Seguir en/.test(await next.innerText())) break;
      await next.click();
    }
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
  });

  test("la sesión tiene su propia guía", async ({ page }) => {
    await page.goto("/tablero");
    await setCode(page, "00350702");
    await startSession(page);
    await page.getByRole("button", { name: "Guía" }).click();
    await expect(title(page)).toHaveText("Tiempo restante");
    await (await nextUntil(page, /^Listo$/)).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Guía" })).toBeFocused();
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
  });
});
