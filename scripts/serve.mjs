// Servidor estático mínimo para la build de producción (`out/`).
// Uso: node scripts/serve.mjs [--port 3000]
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const argPort = process.argv.indexOf("--port");
const port = Number(argPort > -1 ? process.argv[argPort + 1] : process.env.PORT ?? 3000);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

async function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  const candidates = clean === "/" ? ["/index.html"] : [clean, `${clean}.html`, `${clean}/index.html`];
  // Next 16 pide `x/__next.x.__PAGE__.txt`; el export lo escribe como `x/__next.x/__PAGE__.txt`.
  if (/\/__next\.[^/]+\.__PAGE__\.txt$/.test(clean)) candidates.push(clean.replace(/\.__PAGE__\.txt$/, "/__PAGE__.txt"));
  for (const c of candidates) {
    const full = path.join(root, c);
    if (!full.startsWith(root)) return null;
    try {
      const s = await stat(full);
      if (s.isFile()) return full;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = await resolveFile(url.pathname);
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (!file) {
    const notFound = await resolveFile("/404.html");
    res.writeHead(404, { ...headers, "Content-Type": TYPES[".html"] });
    if (notFound) createReadStream(notFound).pipe(res);
    else res.end("No encontrado");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const isSw = url.pathname === "/sw.js";
  const immutable = url.pathname.startsWith("/_next/static/");
  res.writeHead(200, {
    ...headers,
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": isSw ? "no-cache, no-store, must-revalidate" : immutable ? "public, max-age=31536000, immutable" : "no-cache",
    ...(isSw ? { "Service-Worker-Allowed": "/" } : {}),
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Octava (producción) en http://localhost:${port}`);
});
