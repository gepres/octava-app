import { expect, test } from "@playwright/test";
import { countStore, setCode, startSession } from "./helpers";

test("la PWA abre sin red: tablero, presets, sesión e historial", async ({ page, context }) => {
  await page.goto("/");
  // Esperar a que el service worker esté activo y controle la página.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload();
  }
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  const manifest = await page.evaluate(async () => (await fetch("/manifest.webmanifest")).json());
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

  await context.setOffline(true);

  // Primera navegación con <Link> a una ruta que no se había visitado.
  await page.getByRole("navigation", { name: "Secciones" }).first().getByRole("link", { name: "Presets" }).click();
  await expect(page.getByRole("heading", { name: "Concentración" })).toBeVisible();

  // Recarga completa sin red.
  await page.goto("/historial?id=inexistente");
  await expect(page.getByRole("heading", { level: 1, name: /Historial|Aún no hay sesiones/ }).or(page.getByText("Aún no hay sesiones"))).toBeVisible();

  // Crear una sesión sin red.
  await page.goto("/");
  await setCode(page, "20406080");
  await startSession(page);
  await page.getByRole("button", { name: "Finalizar" }).click();
  await page.getByRole("button", { name: "Finalizar ahora" }).click();
  await page.getByRole("button", { name: "Omitir" }).click();
  expect(await countStore(page, "history")).toBe(1);

  // Cerrar y reabrir sin red: el historial se conserva.
  await page.close();
  const again = await context.newPage();
  await again.goto("/historial");
  await expect(again.getByRole("button", { name: /código 20406080/ })).toBeVisible();
  await context.setOffline(false);
});
