import { expect, test } from "@playwright/test";
import { countStore, setCode, setDuration, startSession } from "./helpers";

test.describe("Hallazgos de la revisión posterior", () => {
  test("si la sesión vence mientras se está en el Tablero, se cierra y se puede iniciar otra", async ({ page }) => {
    await page.clock.install();
    await page.goto("/tablero");
    await setDuration(page, 1);
    await startSession(page);
    await page.getByRole("link", { name: "Tablero" }).first().click();
    await expect(page.getByText(/Sesión en curso/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Iniciar sesión/ })).toBeDisabled();
    await page.clock.fastForward("01:30");
    await expect(page.getByText("Tu sesión terminó.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /^Iniciar sesión/ })).toBeEnabled();
    expect(await countStore(page, "history")).toBe(1);
  });

  test("un preset aplicado en otra pestaña no se pierde al editar el Tablero", async ({ page, context }) => {
    await page.goto("/tablero");
    const other = await context.newPage();
    await other.goto("/presets");
    await other.getByRole("button", { name: "Aplicar Concentración" }).click();
    await expect(other.getByText("«Concentración» cargado en el Tablero")).toBeVisible();
    await page.bringToFront();
    // El Tablero abierto recibe el cambio…
    await expect(page.getByRole("button", { name: "Dial 1, valor 3" })).toBeVisible();
    // …y una edición posterior no lo pisa.
    await page.getByRole("button", { name: "Sumar un minuto" }).click();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByRole("button", { name: "Dial 1, valor 3" })).toBeVisible();
    await expect(page.locator("output").first()).toContainText("21");
    await other.close();
  });

  test("una confirmación antigua no finaliza una sesión iniciada después en otra pestaña", async ({ page, context }) => {
    await page.goto("/tablero");
    await setCode(page, "00350702");
    await startSession(page);
    await page.getByRole("button", { name: "Finalizar" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    const other = await context.newPage();
    await other.goto("/sesion");
    await other.getByRole("button", { name: "Finalizar" }).click();
    await other.getByRole("button", { name: "Finalizar ahora" }).click();
    await other.getByRole("button", { name: "Omitir" }).click();
    await other.goto("/tablero");
    await startSession(other);

    await page.bringToFront();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(await countStore(page, "active")).toBe(1);
    expect(await countStore(page, "history")).toBe(1);
    await other.close();
  });
});
