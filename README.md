# Octava

App web instalable (PWA), en español, que acompaña una **práctica simbólica de intención y registro personal**. Tiene ocho diales que forman un código de ocho dígitos, una intención, un testigo opcional y una sesión con temporizador y tono suave opcional. Al terminar se guarda en un historial privado.

> Esta app acompaña una práctica simbólica de intención y registro personal. Los códigos del tablero son valores configurables. Los tonos son sonidos reproducidos por tu dispositivo.

Todo funciona en el navegador: sin cuentas, sin servidor de datos y sin analítica.

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | **Portada** que presenta la app: para qué sirve, cómo funciona, beneficios, privacidad, instalación y preguntas frecuentes. |
| `/tablero` | Tablero: código, intención, duración, testigo y sonido. |
| `/sesion`, `/presets`, `/historial`, `/ajustes` | Resto de la app. |

- **Grupo `(app)`:** las secciones de la app viven en `src/app/(app)/`, con su menú (`AppShell`). La portada (`src/app/page.tsx` y `src/components/landing/`) va aparte y no lleva ese menú.
- **App instalada:** `start_url` es `/tablero`, así que se abre directamente en el Tablero. Si una instalación anterior abre `/` en modo app, la portada la redirige al Tablero.
- **Capturas:** las de la portada (`public/landing/*.webp`) son reales, hechas con datos de ejemplo. Si cambia la interfaz, conviene rehacerlas.
- **Sin promesas terapéuticas:** el pie y las preguntas frecuentes dicen que Octava no sustituye la atención médica ni psicológica.

## Guía de uso dentro de la app

La app trae un recorrido paso a paso hecho con [driver.js](https://driverjs.com). Ilumina cada control y lo explica en una burbuja, con «Siguiente», «Anterior», el progreso y cierre con Escape o con la ×.

- **Cómo abrirla:**
  - **Tablero:** «Ayuda» > «Ver la guía paso a paso».
  - **Ajustes:** «Recorrer la guía de uso».
  - **Sesión:** botón «Guía» de la cabecera, con su propia guía.
- **Recorrido completo:** Tablero (código, diales, perilla, escribir o pegar el código, intención, duración, testigo, sonido, guardar preset, iniciar y secciones) → Presets → Historial → Ajustes. El último paso de cada sección lleva a la siguiente.
- **No se abre sola:** el encargo pide evitar pantallas de bienvenida.
- **Accesibilidad:** la burbuja es un diálogo con nombre y descripción, el foco va a «Siguiente», funcionan las flechas del teclado y, al cerrar, el foco vuelve al botón que la abrió.
- **Movimiento reducido:** sin animaciones.

Los pasos están en `src/guide/guide.ts`. Cada uno señala un elemento con `data-tour="…"`. El estilo está en `globals.css` (`.octava-tour`).

## Requisitos

- Node.js 20.9 o superior. Se probó con Node 26 y npm 11.
- Para las pruebas E2E: Google Chrome instalado. Playwright usa `channel: "chrome"` y no descarga navegadores.

## Instalación

```sh
npm install
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Desarrollo en `http://localhost:3000`. El service worker **no** se registra en desarrollo. |
| `npm run build` | Build de producción: export estático en `out/` y `out/sw.js` con el manifiesto de precache. |
| `npm start` | Sirve `out/` en `http://localhost:3000` con `scripts/serve.mjs`. |
| `npm run typecheck` | TypeScript estricto (`tsc --noEmit`). |
| `npm run lint` | ESLint (configuración de Next.js). |
| `npm test` | Pruebas unitarias y de persistencia (Vitest + `fake-indexeddb`). |
| `npm run test:e2e` | Pruebas E2E con Playwright contra la build. Ejecuta antes `npm run build`. |
| `npm run check` | Tipos, lint, pruebas unitarias y build. |

## Cómo verificar la PWA

1. Ejecuta `npm run build && npm start` y abre `http://localhost:3000` en Chrome o Edge. El service worker solo se activa en `localhost` o con HTTPS.
2. En **DevTools > Application**:
   - **Manifest**: `Octava`, modo `standalone` e iconos de 192 y 512 px, además del adaptable.
   - **Service Workers**: `sw.js` activo.
   - **Cache Storage > `octava-<versión>`**: las 6 páginas (portada incluida), sus payloads `.txt`, los chunks, las fuentes, los iconos y las capturas de la portada.
3. En **Ajustes > Tus datos** aparece «Sin conexión: Disponible» cuando el worker ya controla la página.
4. Marca **Network > Offline**:
   - abre la portada y entra en la app con «Abrir Octava»;
   - navega entre Tablero, Presets, Historial y Ajustes;
   - recarga la página;
   - inicia y termina una sesión;
   - cierra la pestaña y vuelve a abrirla: el historial sigue ahí.
5. Para instalarla:
   - **Chrome o Edge:** botón «Instalar Octava» en Ajustes. Solo aparece si el navegador ofrece la instalación. También sirve el icono de la barra de direcciones.
   - **iPhone (Safari):** Compartir > Añadir a pantalla de inicio.
   - **Safari en Mac:** Archivo > Añadir al Dock.

`npm run test:e2e` automatiza la comprobación sin red en `tests/e2e/pwa.spec.ts`.

## Dónde se guardan los datos

Los datos están en **IndexedDB**, base `octava`, con esquema versionado (`src/storage/db.ts`):

| Store | Contenido |
| --- | --- |
| `presets` | Configuraciones reutilizables: código, duración y tono. Incluye 3 ejemplos con códigos ilustrativos. |
| `active` | La única sesión en curso del navegador (`current`), con su marca de fin o el tiempo restante en pausa. |
| `history` | Registros de sesiones con la configuración congelada, el estado (completada o finalizada antes) y la nota. |
| `images` | Imágenes del testigo, ya reducidas a 1.024 px por lado. Cada sesión tiene la suya. |
| `kv` | Ajustes, borrador del Tablero (con su imagen) y nota pendiente de cierre. |

**Nada sale del dispositivo.** Si borras los datos del sitio en el navegador, se pierden. La app pide almacenamiento persistente al iniciar la primera sesión. En iPhone, instalada como app, Safari conserva mejor los datos.

## Arquitectura

- `src/domain/`: lógica pura del código de 8 dígitos y del temporizador. El tiempo restante se calcula siempre desde el estado persistido: `endsAt` en curso, `remainingMs` en pausa.
- `src/storage/`: repositorios con transacciones atómicas.
  - **Iniciar.** Comprueba que no haya otra sesión activa y la crea, con su imagen, en una sola transacción.
  - **Cerrar.** `history.add` con el id de la sesión, borrado de `current` y nota pendiente, en la misma transacción. Así, un doble toque, dos pestañas o reabrir la app producen **un solo registro**.
  - **Revisión.** Cada acción lleva el `rev` esperado, lo que protege de clics atrasados.
  - **El vencimiento gana.** Pausar o finalizar con el saldo a cero completa la sesión.
- `src/sync/`: `BroadcastChannel` para que las otras pestañas relean IndexedDB. Además, cada ruta reconcilia la sesión al abrirse y al volver a primer plano.
- `src/audio/`: Web Audio con un oscilador senoidal de 220, 432 o 440 Hz y volumen bajo. El sonido está apagado por defecto y solo suena tras un gesto. Se detiene al pausar, finalizar, salir de la vista u ocultar la pestaña. Si el navegador lo bloquea, aparece «Activar audio».
- `src/media/`: validación del testigo (JPEG, PNG o WebP de hasta 5 MiB), decodificación y reducción a 1.024 px.
- `sw/service-worker.js` + `scripts/build-sw.mjs`: worker propio.
  - Precachea todo `out/`: HTML, payloads RSC, chunks, CSS, fuentes e iconos. La caché se versiona con el hash de la build.
  - Las navegaciones se sirven desde la caché de esa misma build. Si falta una página sin red, responde con un aviso explícito.
  - Next 16 pide los segmentos RSC con puntos (`tablero/__next.!KGFwcCk.tablero.__PAGE__.txt`, donde `!KGFwcCk` es el grupo `(app)`), mientras que el export los escribe como carpetas (`tablero/__next.!KGFwcCk/tablero/__PAGE__.txt`). El worker y `scripts/serve.mjs` traducen una forma a la otra.
  - Una versión nueva espera a que se cierren las pestañas de la anterior.

## Pruebas

- **Unitarias** (`tests/unit`):
  - código con ceros iniciales;
  - temporizador en los bordes del vencimiento y con saltos de reloj;
  - inicios y cierres concurrentes con un único registro;
  - fallo de guardado con reintento;
  - nota sobre un registro borrado;
  - limpieza de imágenes, presets, ajustes y borrador.
- **E2E** (`tests/e2e`): la matriz de flujos del encargo, más casos entre pestañas surgidos de la revisión de Codex:
  - diales ↔ código `00350702`;
  - presets que persisten sin alterar el historial;
  - pausa y recarga;
  - vencimiento con dos pestañas y reloj simulado;
  - finalizar antes con nota;
  - audio que parte apagado y se detiene (con `AudioContext` simulado);
  - 360 px y teclado;
  - PWA sin red;
  - una sesión que vence mientras se está en el Tablero;
  - un preset aplicado en otra pestaña que no se pierde;
  - una confirmación antigua que no finaliza una sesión nueva;
  - la guía de uso completa: encadenada entre secciones, ajustada a 360 px, cierre con Escape y guía de la sesión;
  - la portada: secciones, preguntas desplegables, paso al Tablero, sin desbordamiento a 360 px, «Empezar con la guía», redirección cuando se abre como app instalada y apertura sin red.

Resultado: 38 pruebas unitarias y 18 E2E en verde.

## Limitaciones conocidas

- **Audio en segundo plano.** El tono se detiene a propósito al ocultar la pestaña o bloquear la pantalla. En iPhone, el modo silencio puede apagarlo. Tras recargar o volver, algunos navegadores exigen un toque, y por eso aparece «Activar audio».
- **Temporizador con la app cerrada.** No hay avisos ni sonido al terminar si la app no está abierta. Al volver, el tiempo se calcula desde la marca de fin y la sesión se completa una sola vez, con la hora de fin real.
- **Cambios del reloj del sistema.**
  - Con la sesión abierta, un retroceso del reloj se detecta con el reloj monotónico (`performance.now()`) y la marca de fin se vuelve a anclar, así que no alarga la sesión.
  - Si el reloj cambia con la app cerrada, al reabrir se usa la marca de fin guardada: retrasarlo puede alargarla y adelantarlo puede completarla antes.
- **Instalación.**
  - Firefox de escritorio no ofrece instalar apps web: se usa en una pestaña.
  - El botón propio «Instalar Octava» solo aparece cuando el navegador entrega `beforeinstallprompt` (Chrome y Edge).
- **Datos.**
  - No hay copia de seguridad ni exportación en esta versión.
  - En iPhone y iPad, la app instalada guarda sus datos aparte de Safari: lo que se guarda en una no aparece en la otra.
- **Actualizaciones.** Una versión nueva se activa cuando se cierran todas las pestañas de la anterior.
- **Sin probar en dispositivos reales.** No se probó en iPhone real con VoiceOver ni en Safari. Las pruebas automáticas usan Chrome de escritorio.

## Revisión con Codex

Codex CLI revisó el proyecto dos veces, con `gpt-6.2-sol`, razonamiento `xhigh` y `--sandbox read-only`. Claude Code verificó cada hallazgo antes de aplicarlo.

1. **Antes de implementar** revisó la propuesta de arquitectura. Se aplicó:
   - transacciones únicas con número de revisión;
   - «el vencimiento gana»;
   - cierre automático con la hora de fin real;
   - export estático con precache generado desde la build;
   - borrador con el blob dentro e imagen exclusiva por sesión;
   - audio con token por activación;
   - código antes que los diales en el orden de foco.
2. **Después de las primeras pruebas** revisó el código y el diff, y devolvió 14 hallazgos. Todos se aplicaron:
   - confirmación de «Finalizar» atada a la sesión y revisión con las que se abrió;
   - borrador guardado por parches, con reintento si falla;
   - notas con detección de conflictos entre pestañas;
   - cierre automático programado desde cualquier vista;
   - precache con URL canónicas y sin respuestas redirigidas;
   - campo de código sincronizado con la perilla;
   - reanclaje ante retrocesos del reloj;
   - nota de cierre fijada al escribir;
   - el tono solo se detiene cuando el cierre se confirma;
   - `statechange` del `AudioContext` con «Activar audio»;
   - «Sonido al iniciar» heredado hasta que se elija en el Tablero;
   - foco que vuelve al botón al cerrar el diálogo;
   - aviso de datos separados en iOS.
