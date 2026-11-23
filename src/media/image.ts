import type { ImageData } from "@/domain/types";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_SIDE = 1024;

export class ImageRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejected";
  }
}

/** Comprueba tipo y tamaño antes de intentar decodificar. */
export function checkImageFile(file: { type: string; size: number; name?: string }): void {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    const heic = /\.hei[cf]$/i.test(file.name ?? "") || /heic|heif/i.test(file.type);
    throw new ImageRejected(
      heic
        ? "No es JPEG, PNG ni WebP. Las fotos HEIC del iPhone se pueden exportar como JPEG."
        : "No es JPEG, PNG ni WebP.",
    );
  }
  if (file.size > MAX_BYTES) {
    const mib = (file.size / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 });
    throw new ImageRejected(`La imagen pesa ${mib} MiB. El máximo es 5 MiB.`);
  }
}

export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Valida, decodifica y reduce la imagen a 1.024 px por lado como máximo.
 * Se hace antes de abrir cualquier transacción de IndexedDB.
 */
export async function processWitnessImage(file: File): Promise<ImageData & { name: string }> {
  checkImageFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageRejected("No se pudo abrir la imagen. Prueba con otro archivo.");
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageRejected("Este navegador no puede procesar la imagen.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const outType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType, 0.86));
    if (!blob) throw new ImageRejected("No se pudo procesar la imagen.");
    return { blob, type: blob.type || outType, width, height, bytes: blob.size, name: file.name };
  } finally {
    bitmap.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
}
