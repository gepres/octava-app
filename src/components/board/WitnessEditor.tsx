"use client";

import { useId, useRef, useState } from "react";
import type { ImageData } from "@/domain/types";
import { formatBytes, ImageRejected, processWitnessImage } from "@/media/image";
import { useObjectUrl } from "@/hooks/misc";
import { IconImage } from "@/components/Icons";

type DraftImage = (ImageData & { name: string }) | null;

interface Props {
  alias: string;
  image: DraftImage;
  onAlias: (alias: string) => void;
  onImage: (image: DraftImage) => void;
}

/** Testigo opcional: una referencia de la sesión con un alias, una imagen local o ambos. */
export function WitnessEditor({ alias, image, onAlias, onImage }: Props) {
  const aliasId = useId();
  const fileId = useId();
  const errId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useObjectUrl(image?.blob);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onImage(await processWitnessImage(file));
    } catch (e) {
      setError(e instanceof ImageRejected ? e.message : "No se pudo abrir la imagen. Prueba con otro archivo.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm leading-normal text-ink-2">Una referencia para tu sesión: un nombre, una imagen o ambos.</p>
      <div className="flex flex-col gap-2">
        <label htmlFor={aliasId} className="text-sm font-medium">
          Alias del testigo
        </label>
        <input
          id={aliasId}
          className="field"
          type="text"
          maxLength={80}
          value={alias}
          placeholder="Por ejemplo «Mi jardín»"
          onChange={(e) => onAlias(e.target.value)}
        />
      </div>
      {image ? (
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Imagen del testigo" className="h-16 w-16 rounded-[14px] border border-white/10 object-cover" />
          ) : (
            <span className="h-16 w-16 rounded-[14px] bg-white/5" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm">{image.name}</span>
            <span className="text-[13px] text-ink-3">
              {image.width} × {image.height} · {formatBytes(image.bytes)}
            </span>
          </div>
          <button type="button" className="btn-link !text-ink-2" onClick={() => onImage(null)}>
            Quitar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label htmlFor={fileId} className="btn-glass !min-h-11 cursor-pointer !px-4 !text-[15px]">
            <IconImage size={18} />
            {busy ? "Procesando…" : "Elegir imagen"}
          </label>
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-describedby={error ? errId : undefined}
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
      )}
      {error ? (
        <p id={errId} role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="m-0 text-[13px] text-ink-3">JPEG, PNG o WebP · hasta 5 MiB · se guarda solo en este dispositivo.</p>
      )}
    </div>
  );
}
