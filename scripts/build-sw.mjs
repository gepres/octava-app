// Genera out/sw.js a partir de sw/service-worker.js con el manifiesto de precache de la build.
// Se ejecuta después de `next build` (output: "export").
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");

/** Archivos que necesita el núcleo de la app sin red. */
const INCLUDE = /\.(html|txt|js|css|woff2?|png|webmanifest|ico|svg|json)$/i;
const EXCLUDE = [/^sw\.js$/, /^404/, /^_not-found/, /\.map$/];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const all = (await walk(out))
  .map((f) => path.relative(out, f).split(path.sep).join("/"))
  .filter((f) => INCLUDE.test(f) && !EXCLUDE.some((rx) => rx.test(f)))
  .sort();

const hash = createHash("sha256");
let bytes = 0;
for (const f of all) {
  const buf = await readFile(path.join(out, f));
  bytes += (await stat(path.join(out, f))).size;
  hash.update(f).update(buf);
}
const version = hash.digest("hex").slice(0, 12);
const urls = all.map((f) => `/${f}`);

const template = await readFile(path.join(root, "sw", "service-worker.js"), "utf8");
const sw = template.replace('"__VERSION__"', JSON.stringify(version)).replace("__PRECACHE__", JSON.stringify(urls, null, 0));
await writeFile(path.join(out, "sw.js"), sw);

const pages = urls.filter((u) => u.endsWith(".html"));
console.log(`sw.js: versión ${version}, ${urls.length} archivos (${(bytes / 1024).toFixed(0)} KB), páginas: ${pages.join(", ")}`);
