"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import type { CodeMeaning } from "@/domain/types";
import { proposeCode } from "@/domain/propose";
import { MEANING_DESCRIPTION_MAX, MEANING_NAME_MAX, deleteMeaning, saveMeaning, validateMeaning, type MeaningValidation } from "@/storage/meanings";
import { Modal } from "@/components/Modal";
import { IconCheck, IconPencil, IconPlus, IconSparkle } from "@/components/Icons";

/**
 * Bajo los diales: qué significa el código para la persona, o la invitación a darle significado.
 * Los dos estados usan el mismo botón para que el foco no se pierda al cambiar de uno a otro.
 */
export function MeaningLine({ meaning, onEdit }: { meaning: CodeMeaning | undefined; onEdit: () => void }) {
  return (
    <div data-tour="meaning" className="mt-1 flex justify-center">
      <button
        type="button"
        onClick={onEdit}
        className={
          meaning
            ? "group mt-1 flex w-full max-w-[440px] items-center gap-3 rounded-[18px] border border-copper-light/20 bg-gradient-to-b from-copper/[0.13] to-copper/[0.05] px-4 py-2.5 text-left text-ink transition-colors hover:border-copper-light/35"
            : "btn-link"
        }
      >
        {meaning ? (
          <>
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-copper-light shadow-[0_0_10px_rgba(217,162,115,0.75)]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="sr-only">Editar el significado del código: </span>
              <span className="truncate text-[15px] font-semibold text-copper-pale">{meaning.name}</span>
              {meaning.description ? <span className="truncate text-[13px] text-ink-3">{meaning.description}</span> : null}
            </span>
            <IconPencil size={16} className="shrink-0 text-ink-3 transition-colors group-hover:text-ink-2" />
          </>
        ) : (
          <>
            <IconPlus size={16} strokeWidth={2} />
            Darle significado a este código
          </>
        )}
      </button>
    </div>
  );
}

interface MeaningModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  meaning: CodeMeaning | undefined;
  /** Descripción con la que empezar si el código aún no tiene significado. */
  suggestedDescription?: string;
  onSaved: (m: CodeMeaning) => void;
  onRemoved: (code: string) => void;
  returnFocus?: () => HTMLElement | null;
}

/** Escribir, cambiar o quitar el significado de un código. */
export function MeaningModal({ open, onClose, code, meaning, suggestedDescription, onSaved, onRemoved, returnFocus }: MeaningModalProps) {
  const nameId = useId();
  const descId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<MeaningValidation>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    // Al abrir se reinician los campos durante el render; el <dialog> sigue montado para devolver el foco.
    setWasOpen(open);
    if (open) {
      setName(meaning?.name ?? "");
      setDescription(meaning?.description ?? (suggestedDescription ?? "").slice(0, MEANING_DESCRIPTION_MAX));
      setErrors({});
      setFailure(null);
    }
  }

  async function save() {
    const input = { name, description };
    const errs = validateMeaning(input);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFailure(null);
    try {
      onSaved(await saveMeaning(code, input));
    } catch {
      setFailure("No se pudo guardar el significado. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setFailure(null);
    try {
      await deleteMeaning(code);
      onRemoved(code);
    } catch {
      setFailure("No se pudo quitar el significado. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={meaning ? "Significado del código" : "Darle significado"} returnFocus={returnFocus}>
      <div className="relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.035] py-4">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 120% at 50% 0%, rgba(217,162,115,0.14), rgba(217,162,115,0) 70%)" }} />
        <span className="relative text-[13px] text-ink-3">Código</span>
        <span className="relative text-[30px] font-light leading-none tracking-[0.2em]">{code}</span>
      </div>
      <p className="m-0 text-[13px] leading-snug text-ink-3">
        Un código significa lo que tú decidas. Ponle un nombre corto para reconocerlo en el Tablero, la sesión y el historial.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-sm font-medium">Nombre</label>
        <input
          id={nameId}
          className="field"
          type="text"
          maxLength={MEANING_NAME_MAX}
          autoFocus
          value={name}
          placeholder="Por ejemplo «Enfoque»"
          aria-invalid={errors.name ? "true" : "false"}
          aria-describedby={errors.name ? `${nameId}-e` : undefined}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
        />
        {errors.name ? <p id={`${nameId}-e`} role="alert" className="m-0 text-sm text-danger">{errors.name}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={descId} className="text-sm font-medium">
          Descripción <span className="font-normal text-ink-3">· opcional</span>
        </label>
        <textarea
          id={descId}
          className="field resize-none"
          rows={3}
          maxLength={MEANING_DESCRIPTION_MAX}
          value={description}
          placeholder="¿Qué representa para ti este código?"
          aria-invalid={errors.description ? "true" : "false"}
          aria-describedby={errors.description ? `${descId}-e` : undefined}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors.description ? <p id={`${descId}-e`} role="alert" className="m-0 text-sm text-danger">{errors.description}</p> : null}
      </div>
      {failure ? <p role="alert" className="m-0 text-sm text-danger">{failure}</p> : null}
      <div className="flex gap-3">
        <button type="button" className="btn-glass" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-go flex-1" onClick={() => void save()} disabled={busy}>Guardar significado</button>
      </div>
      {meaning ? (
        <button type="button" className="btn-link self-center !text-danger hover:!text-danger-strong" onClick={() => void remove()} disabled={busy}>
          Quitar significado
        </button>
      ) : null}
    </Modal>
  );
}

interface MyCodesProps {
  open: boolean;
  onClose: () => void;
  meanings: CodeMeaning[] | undefined;
  currentCode: string;
  onUse: (m: CodeMeaning) => void;
  onEdit: (m: CodeMeaning) => void;
  returnFocus?: () => HTMLElement | null;
}

/** Los códigos con significado: se eligen por lo que significan, no por sus cifras. */
export function MyCodesModal({ open, onClose, meanings, currentCode, onUse, onEdit, returnFocus }: MyCodesProps) {
  const list = meanings ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mis códigos"
      returnFocus={returnFocus}
      description="Los códigos a los que diste un significado. Elige uno para ponerlo en los diales."
    >
      {list.length === 0 ? (
        <p className="m-0 rounded-2xl bg-white/[0.035] px-4 py-3.5 text-[15px] leading-snug text-ink-2">
          Aún no has dado significado a ningún código. Pon uno en los diales y toca «Darle significado a este código».
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list.map((m) => (
            <CodeRow key={m.code} meaning={m} current={m.code === currentCode} onUse={() => onUse(m)} onEdit={() => onEdit(m)} />
          ))}
        </ul>
      )}
      <button type="button" className="btn-glass" onClick={onClose}>Cerrar</button>
    </Modal>
  );
}

function CodeRow({ meaning, current, onUse, onEdit }: { meaning: CodeMeaning; current: boolean; onUse: () => void; onEdit: () => void }) {
  const descId = useId();
  return (
    <li
      className={clsx(
        "flex items-center gap-2 rounded-[18px] border py-1.5 pl-4 pr-1.5",
        current ? "border-turq/40 bg-gradient-to-r from-turq-deep/[0.13] to-turq-deep/[0.03]" : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <button
        type="button"
        onClick={onUse}
        aria-label={`Usar ${meaning.name}, código ${meaning.code}`}
        aria-describedby={meaning.description ? descId : undefined}
        className="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-0.5 bg-transparent py-1.5 text-left text-ink"
      >
        <span className="flex min-w-0 items-baseline gap-2.5">
          <span className="truncate text-[15px] font-semibold">{meaning.name}</span>
          <span className="shrink-0 text-[13px] tracking-[0.14em] text-copper-light">{meaning.code}</span>
        </span>
        {meaning.description ? <span id={descId} className="line-clamp-2 text-[13px] leading-snug text-ink-3">{meaning.description}</span> : null}
      </button>
      {current ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-turq">
          <IconCheck size={14} /> En los diales
        </span>
      ) : null}
      <button type="button" className="round sm" aria-label={`Editar ${meaning.name}`} onClick={onEdit}>
        <IconPencil size={16} />
      </button>
    </li>
  );
}

/** Bajo la intención: el código que Octava deriva de ella, con la explicación del cálculo. */
export function ProposedCode({ intention, currentCode, onUse }: { intention: string; currentCode: string; onUse: (code: string) => void }) {
  const code = proposeCode(intention);
  const inDials = code !== null && code === currentCode;
  return (
    <div data-tour="propose-code" className="flex flex-col gap-1.5 rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="ico !h-9 !w-9"><IconSparkle size={18} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-ink-3">Código de tu intención</span>
          {code ? (
            <span className="text-[17px] font-medium leading-tight tracking-[0.16em]">{code}</span>
          ) : (
            <span className="text-sm leading-snug text-ink-2">Escribe tu intención y Octava te propondrá un código.</span>
          )}
        </div>
        {code && inDials ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-turq">
            <IconCheck size={16} /> En los diales
          </span>
        ) : null}
        {code && !inDials ? (
          <button type="button" className="btn-soft shrink-0" aria-label={`Usar el código ${code}`} onClick={() => onUse(code)}>
            Usar
          </button>
        ) : null}
      </div>
      <details className="group pl-12 [&_summary::-webkit-details-marker]:hidden">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center text-[13px] font-medium text-turq hover:text-[#9befe6]">
          ¿Cómo se calcula?
        </summary>
        <p className="m-0 mt-1 text-[13px] leading-relaxed text-ink-3">
          Cada letra vale una cifra, como en la numerología pitagórica: a = 1, b = 2 … i = 9, y se vuelve a empezar (j = 1). Octava reparte las letras de tu intención en ocho grupos, por turnos, y se queda con la última cifra de cada suma. No cuenta tildes, espacios ni signos: la misma intención da siempre el mismo código. Es una forma simbólica de unir tu intención y tu código.
        </p>
      </details>
    </div>
  );
}
