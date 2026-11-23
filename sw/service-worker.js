/* Service worker de Octava.
 * Plantilla: scripts/build-sw.mjs inyecta la versión y el manifiesto de precache
 * generado a partir de `out/` después de `next build`.
 */
const VERSION = "__VERSION__";
const PRECACHE = /** @type {string[]} */ (__PRECACHE__);
const CACHE = `octava-${VERSION}`;
const PREFIX = "octava-";

/** Clave de caché para una URL del mismo origen: sin `_rsc` y con la ruta limpia del HTML. */
function keyFor(url) {
  const u = new URL(url, self.location.origin);
  u.searchParams.delete("_rsc");
  u.hash = "";
  return u.pathname + (u.search && u.search !== "?" ? u.search : "");
}

/** Next 16 pide `x/__next.x.__PAGE__.txt`; el export lo escribe como `x/__next.x/__PAGE__.txt`. */
function segmentAlias(pathname) {
  return /\/__next\.[^/]+\.__PAGE__\.txt$/.test(pathname) ? pathname.replace(/\.__PAGE__\.txt$/, "/__PAGE__.txt") : pathname;
}

/** `/historial` → `/historial.html`; `/` → `/index.html`. */
function htmlFor(pathname) {
  if (pathname === "/" || pathname === "") return "/index.html";
  const clean = pathname.replace(/\/+$/, "");
  return clean.endsWith(".html") ? clean : `${clean}.html`;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Si falta un recurso indispensable, la instalación falla y sigue activa la versión anterior.
      await cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" })));
    })(),
  );
  // Sin skipWaiting: la versión nueva espera a que se cierren las pestañas de la anterior.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    event.respondWith(navigationResponse(req, url));
    return;
  }
  event.respondWith(assetResponse(req, url));
});

async function navigationResponse(req, url) {
  const cache = await caches.open(CACHE);
  // Primero la versión precacheada de esta build: coherente con sus chunks.
  const cached = await cache.match(htmlFor(url.pathname));
  if (cached) return cached;
  try {
    return await fetch(req);
  } catch {
    return offlinePage();
  }
}

async function assetResponse(req, url) {
  const cache = await caches.open(CACHE);
  const key = keyFor(req.url);
  const hit =
    (await cache.match(key)) ||
    (await cache.match(key.split("?")[0])) ||
    (await cache.match(segmentAlias(key.split("?")[0])));
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // Guardar en tiempo de ejecución solo recursos estáticos inmutables de la build.
    if (res.ok && url.pathname.startsWith("/_next/static/")) await cache.put(key, res.clone());
    return res;
  } catch {
    return new Response("Sin conexión: este recurso no está guardado en el dispositivo.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function offlinePage() {
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Octava</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C0E;color:#F2EEE8;font-family:system-ui,sans-serif">
<main style="max-width:28rem;padding:24px;text-align:center">
<h1 style="font-weight:600">Esta página no está disponible sin conexión</h1>
<p style="color:#CFC9BF;line-height:1.5">Octava guarda sus pantallas principales en el dispositivo. Abre el <a style="color:#6BE4D7" href="/">Tablero</a> o vuelve a intentarlo con conexión.</p>
</main></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
