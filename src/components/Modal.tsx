"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import clsx from "clsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** `alertdialog` para confirmaciones destructivas. */
  role?: "dialog" | "alertdialog";
  description?: string;
  /** Hoja inferior en móvil, diálogo centrado en escritorio. */
  className?: string;
}

/**
 * Diálogo nativo (`<dialog>` con `showModal`): atrapa el foco, cierra con Escape
 * y devuelve el foco al control que lo abrió.
 */
export function Modal({ open, onClose, title, children, role = "dialog", description, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      d.close();
      const el = opener.current as HTMLElement | null;
      if (el && document.contains(el)) el.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={clsx(
        "modal m-0 w-full self-end lg:m-auto lg:w-[min(480px,calc(100vw-48px))] lg:self-auto",
        "fixed inset-x-0 bottom-0 top-auto lg:inset-0",
      )}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div
          className={clsx(
            "float flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-[28px] px-4 pb-6 pt-3 lg:rounded-[28px] lg:p-7",
            className,
          )}
        >
          <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden" />
          <h2 id={titleId} className="m-0 text-xl font-semibold tracking-[-0.02em] lg:text-2xl">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="m-0 text-[15px] leading-relaxed text-ink-2">
              {description}
            </p>
          ) : null}
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
