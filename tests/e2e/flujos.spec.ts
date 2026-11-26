import { expect, test } from "@playwright/test";
import { countStore, setCode, setDuration, startSession, timerText } from "./helpers";

test.describe("Matriz de flujos", () => {
  test("diales y código 00350702 quedan sincronizados y conservan los ceros", async ({ page }) => {
    await page.goto("/tablero");
    await setCode(page, "00350702");
    const expected = [0, 0, 3, 5, 0, 7, 0, 2];
    for (let i = 0; i < 8; i++) {
      await expect(page.getByRole("button", { name: `Dial ${i + 1}, valor ${expected[i]}` })).toBeVisible();
    }
    // Teclado sobre los diales: dial 1, flecha arriba → 1.
    await page.getByRole("button", { name: "Dial 1, valor 0" }).focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("button", { name: "Dial 1, valor 1" })).toBeFocused();
    // Control nativo accesible del dial seleccionado.
    await page.getByRole("button", { name: "Dial 3, valor 3" }).click();
    await page.getByRole("slider", { name: "Dial 3" }).fill("9");
    await page.getByRole("button", { name: "Escribir código" }).click();
    await expect(page.getByLabel("Código de 8 dígitos")).toHaveValue("10950702");
    // Entrada inválida: el error se asocia al campo e impide iniciar.
    await page.getByLabel("Código de 8 dígitos").fill("0035");
    await expect(page.getByRole("alert").filter({ hasText: "Faltan 4 dígitos." })).toBeVisible();
    await expect(page.getByLabel("Código de 8 dígitos")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: /^Iniciar sesión/ })).toBeDisabled();
    // El código persiste al recargar.
    await page.getByLabel("Código de 8 dígitos").fill("00350702");
    await page.getByRole("button", { name: "Listo" }).click();
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByRole("button", { name: "Dial 3, valor 3" })).toBeVisible();
  });

  test("guardar, editar y eliminar un preset persiste; el historial conserva los valores originales", async ({ page }) => {
    await page.goto("/presets");
    await expect(page.getByText("Ejemplo · código ilustrativo")).toHaveCount(3);
    await page.getByRole("button", { name: "Nuevo preset" }).click();
    await page.getByLabel("Nombre").fill("Mañana tranquila");
    await page.getByLabel("Código").fill("00350702");
    await page.getByLabel("Minutos").fill("2");
    await page.getByRole("button", { name: "432 Hz" }).click();
    await page.getByRole("button", { name: "Guardar preset" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mañana tranquila" })).toBeVisible();

    // Aplicar carga en el Tablero sin iniciar.
    await page.getByRole("button", { name: "Aplicar Mañana tranquila" }).click();
    await page.getByRole("link", { name: "Ir al Tablero", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dial 4, valor 5" })).toBeVisible();
    expect(await countStore(page, "active")).toBe(0);

    await startSession(page);
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
    await page.getByRole("button", { name: "Omitir" }).click();

    // Editar el preset no cambia la sesión pasada.
    await page.goto("/presets");
    await page.getByRole("button", { name: "Editar Mañana tranquila" }).click();
    await page.getByLabel("Código").fill("11111111");
    await page.getByRole("button", { name: "Guardar preset" }).click();
    await page.reload();
    await expect(page.getByText("11111111")).toBeVisible();

    // Eliminar con confirmación.
    await page.getByRole("button", { name: "Editar Mañana tranquila" }).click();
    await page.getByRole("button", { name: "Eliminar preset" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mañana tranquila" })).toHaveCount(0);

    await page.goto("/historial");
    await expect(page.getByRole("button", { name: /código 00350702/ })).toBeVisible();
  });

  test("iniciar, pausar y recargar recupera la pausa con el mismo tiempo", async ({ page }) => {
    await page.goto("/tablero");
    await setCode(page, "12345678");
    await startSession(page);
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByText("En pausa")).toBeVisible();
    const before = await timerText(page);
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByText("En pausa")).toBeVisible();
    expect(await timerText(page)).toBe(before);
    await page.getByRole("button", { name: "Reanudar" }).click();
    await expect(page.getByText("En curso")).toBeVisible();
    // Limpieza: finalizar.
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
    await expect(page.getByText("Sesión finalizada antes")).toBeVisible();
  });

  test("volver después del vencimiento deja un único registro, también con otra pestaña", async ({ page, context }) => {
    await page.clock.install();
    await page.goto("/tablero");
    await setDuration(page, 1);
    await startSession(page);
    const other = await context.newPage();
    await other.goto("/sesion");
    await expect(other.getByRole("timer")).toBeVisible();
    // Ambas pestañas comparten el reloj del contexto.
    await page.clock.fastForward("02:00");
    await expect(page.getByText("Sesión completada")).toBeVisible({ timeout: 15_000 });
    await other.bringToFront();
    await expect(other.getByText(/Sesión completada|Guardada en el historial/)).toBeVisible({ timeout: 15_000 });
    expect(await countStore(page, "history")).toBe(1);
    expect(await countStore(page, "active")).toBe(0);
    await other.reload();
    expect(await countStore(other, "history")).toBe(1);
    await other.close();
    await page.goto("/historial");
    await expect(page.getByRole("button", { name: /completada/ })).toHaveCount(1);
  });

  test("finalizar antes del límite permite guardar la nota y se distingue en el historial", async ({ page }) => {
    await page.goto("/tablero");
    await setCode(page, "00350702");
    await startSession(page);
    await page.getByRole("button", { name: "Finalizar" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("finalización anticipada");
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
    await expect(page.getByText("Sesión finalizada antes")).toBeVisible();
    await page.getByLabel("Nota").fill("La terminé antes para entrar a la reunión.");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByRole("heading", { name: "Guardada en el historial" })).toBeVisible();
    await page.getByRole("link", { name: "Ver historial" }).click();
    await expect(page.getByText("Finalizada antes").first()).toBeVisible();
    await expect(page.getByLabel("Nota")).toHaveValue("La terminé antes para entrar a la reunión.");
  });

  test("el audio parte apagado y se detiene al pausar, al ocultar la pestaña y al finalizar", async ({ page }) => {
    await page.addInitScript(() => {
      // AudioContext simulado: cuenta osciladores sonando.
      const w = window as unknown as { __osc: { started: number; playing: number } };
      w.__osc = { started: 0, playing: 0 };
      class FakeParam {
        value = 0;
        setValueAtTime() {}
        linearRampToValueAtTime() {}
        setTargetAtTime() {}
        cancelScheduledValues() {}
      }
      class FakeNode {
        connect(n: unknown) { return n; }
        disconnect() {}
      }
      class FakeOsc extends FakeNode {
        type = "sine";
        frequency = new FakeParam();
        onended: null | (() => void) = null;
        private on = false;
        start() { this.on = true; w.__osc.started++; w.__osc.playing++; }
        stop() { if (this.on) { this.on = false; w.__osc.playing--; } }
      }
      class FakeGain extends FakeNode { gain = new FakeParam(); }
      class FakeCtx {
        state = "running";
        currentTime = 0;
        destination = {};
        resume() { this.state = "running"; return Promise.resolve(); }
        createOscillator() { return new FakeOsc(); }
        createGain() { return new FakeGain(); }
      }
      (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
    });
    const playing = () => page.evaluate(() => (window as unknown as { __osc: { playing: number } }).__osc.playing);

    await page.goto("/tablero");
    await expect(page.getByRole("switch", { name: "Sonido ambiental" })).toHaveAttribute("aria-checked", "false");
    await page.getByRole("switch", { name: "Sonido ambiental" }).click();
    await startSession(page);
    await expect.poll(playing).toBe(1);
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect.poll(playing).toBe(0);
    await page.getByRole("button", { name: "Reanudar" }).click();
    await expect.poll(playing).toBe(1);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(playing).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(playing).toBe(1);
    await page.getByRole("button", { name: "Sonido" }).click();
    await expect.poll(playing).toBe(0);
    await page.getByRole("button", { name: "Sonido" }).click();
    await expect.poll(playing).toBe(1);
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
    await expect.poll(playing).toBe(0);
  });

  test("a 360 px y con teclado se completa el flujo principal sin recortes", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/tablero");
    // Se mide con el Tablero ya cargado (diales, halo y significado), no con «Cargando…».
    await expect(page.locator("[data-tour=meaning]")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // Escribir el código con el teclado sobre los diales.
    await page.getByRole("button", { name: /^Dial 1, valor/ }).focus();
    for (const d of "00350702") await page.keyboard.press(d);
    await expect(page.getByRole("button", { name: "Dial 8, valor 2" })).toBeVisible();
    // Llegar a «Iniciar sesión» solo con Tab.
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => document.activeElement?.textContent?.includes("Iniciar sesión") ?? false);
    }
    expect(found).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/sesion");
    await page.getByRole("button", { name: "Pausar" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("En pausa")).toBeVisible();
    const overflowSesion = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflowSesion).toBeLessThanOrEqual(0);
    // Controles principales de al menos 44 × 44 px.
    for (const name of ["Reanudar", "Finalizar"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box && box.width >= 44 && box.height >= 44).toBe(true);
    }
    await page.getByRole("button", { name: "Finalizar" }).click();
    await page.getByRole("button", { name: "Finalizar ahora" }).click();
    await expect(page.getByText("Sesión finalizada antes")).toBeVisible();
  });
});
