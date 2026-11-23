"use client";

import Link from "next/link";
import { useEffect } from "react";
import clsx from "clsx";
import { IconCheck } from "./Icons";

export interface ToastData {
  text: string;
  href?: string;
  linkText?: string;
}

/** Aviso breve que no roba el foco. */
export function Toast({ toast, onDone, className }: { toast: ToastData | null; onDone: () => void; className?: string }) {
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(id);
  }, [toast, onDone]);

  return (
    <div role="status" aria-live="polite" className={clsx("pointer-events-none fixed z-40", className)}>
      {toast ? (
        <div className="float pointer-events-auto flex items-center justify-between gap-3 rounded-[22px] py-1.5 pl-4 pr-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <IconCheck size={18} className="shrink-0 text-turq" />
            <span className="truncate">{toast.text}</span>
          </span>
          {toast.href ? (
            <Link href={toast.href} className="btn-link whitespace-nowrap !px-2.5 font-semibold">
              {toast.linkText}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
