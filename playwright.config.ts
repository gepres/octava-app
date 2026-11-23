import { defineConfig } from "@playwright/test";

/**
 * Pruebas E2E contra la build de producción exportada (`out/`).
 * Requiere `npm run build` antes. Usa el Chrome instalado en el equipo (channel: "chrome").
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    locale: "es-ES",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/serve.mjs --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
