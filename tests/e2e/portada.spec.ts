import { expect, test } from "@playwright/test";

test.describe("Portada", () => {
  test("presenta Octava, sus beneficios y lleva al Tablero", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Octava · Ocho diales para sostener tu intención");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ocho diales para sostener tu intención.");
    // La portada no lleva el menú de la app.
    await expect(page.getByRole("navigation", { name: "Secciones", exact: true })).toHaveCount(0);

    for (const name of [
      "Un ritual breve para los momentos que quieres cuidar.",
      "Tres pasos, sin curva de aprendizaje.",
      "Hecha para acompañarte, no para distraerte.",
      "Lo tuyo se queda contigo.",
      "Tenla a mano, como una app.",
      "Lo que suele preguntarse.",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
    await expect(page.getByRole("img", { name: /El Tablero de Octava en el ordenador/ })).toBeVisible();

    // Preguntas frecuentes: se despliegan con un clic.
    const faq = page.getByText("¿Octava sustituye un tratamiento?");
    await faq.click();
    await expect(page.getByText(/No ofrece diagnósticos ni sustituye la atención médica/).first()).toBeVisible();

    await page.getByRole("banner").getByRole("link", { name: "Abrir Octava" }).click();
    await page.waitForURL("**/tablero");
    await expect(page.getByRole("button", { name: /^Dial 1, valor/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Secciones" }).first()).toBeVisible();
  });

  test("en móvil cabe a 360 px sin desplazamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("img", { name: /Tablero en el móvil/ })).toBeVisible();
  });

  test("«Empezar con la guía» abre el Tablero con la guía", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Empezar con la guía" }).click();
    await expect(page.locator(".driver-popover.octava-tour .driver-popover-title")).toHaveText("Así se usa Octava");
  });

  test("abierta como app instalada, va directa al Tablero", async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query === "(display-mode: standalone)" ? ({ ...original(query), matches: true, media: query } as MediaQueryList) : original(query);
    });
    await page.goto("/");
    await page.waitForURL("**/tablero");
    await expect(page.getByRole("button", { name: /^Dial 1, valor/ })).toBeVisible();
  });
});
