import type { NextConfig } from "next";

/**
 * Octava es una app solo de cliente: todo vive en IndexedDB.
 * Se exporta como sitio estático (`out/`) y el service worker se genera
 * después del build con el manifiesto de esos archivos (scripts/build-sw.mjs).
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
