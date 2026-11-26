"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { codeFigurePoints } from "@/domain/code";
import { formatClock } from "@/domain/timer";
import type { SessionRecord } from "@/domain/types";
import { deleteRecord, getImageBlob, listHistory, NoteConflict, RecordMissing, saveNote } from "@/storage/sessions";
import { draftFromRecord } from "@/storage/kv";
import { useLive } from "@/hooks/useLive";
import { useIsDesktop, useObjectUrl } from "@/hooks/misc";
import { useAnnounce } from "@/components/Announcer";
import { Modal } from "@/components/Modal";
import { IconChevronLeft, IconChevronRight, IconRepeat, IconTrash } from "@/components/Icons";
import { useGuide } from "@/guide/useGuide";

type Filter = "all" | "completed" | "ended-early";
const FILTERS: Array<[Filter, string]> = [
  ["all", "Todas"],
  ["completed", "Completadas"],
  ["ended-early", "Finalizadas antes"],
];

export function HistorialView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isDesktop = useIsDesktop();
  const history = useLive(["history"], listHistory);
  const [filter, setFilter] = useState<Filter>("all");
  const selectedId = params.get("id");
  useGuide("historial", !history.loading);

  const records = useMemo(() => history.data ?? [], [history.data]);
  const visible = useMemo(() => records.filter((r) => filter === "all" || r.status === filter), [records, filter]);
  const selected = records.find((r) => r.id === selectedId) ?? null;
  const current = isDesktop ? selected ?? visible[0] ?? null : selected;

  function select(id: string | null) {
    const url = id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname;
    if (isDesktop) router.replace(url, { scroll: false });
    else router.push(url);
  }

  if (history.error) {
    return (
      <Wrap>
        <p role="alert" className="text-danger">No se pudo leer el historial del almacenamiento local.</p>
        <button type="button" className="btn-glass" onClick={history.reload}>Reintentar</button>
      </Wrap>
    );
  }

  if (!history.loading && records.length === 0) {
    return (
      <Wrap>
        <div data-tour="history-empty" className="glass mx-auto mt-6 flex max-w-md flex-col items-center gap-4 rounded-[28px] p-8 text-center">
          <h2 className="m-0 text-xl font-semibold">Aún no hay sesiones</h2>
          <p className="m-0 text-ink-2">Cuando termines una sesión aparecerá aquí con su código, su duración y tu nota.</p>
          <Link href="/tablero" className="btn-go no-underline">Ir al Tablero</Link>
        </div>
      </Wrap>
    );
  }

  // Móvil con un registro abierto: vista de detalle a pantalla completa.
  if (!isDesktop && selectedId) {
    return (
      <Wrap
        title={
          <button type="button" className="btn-link !text-ink-2" onClick={() => router.push(pathname)}>
            <IconChevronLeft size={18} /> Historial
          </button>
        }
      >
        {selected ? (
          <RecordDetail key={selected.id} record={selected} onDeleted={() => router.replace(pathname)} />
        ) : history.loading ? (
          <p className="text-ink-3">Cargando…</p>
        ) : (
          <p className="text-ink-2">Este registro ya no existe. Puede que se haya borrado.</p>
        )}
      </Wrap>
    );
  }

  return (
    <Wrap
      actions={
        <div className="seg grid-cols-3" role="group" aria-label="Filtrar por estado" data-tour="history-filter">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="!px-3">
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap items-start gap-[22px]">
        <section aria-label="Sesiones" className="min-w-0 flex-[3_1_520px]">
          {visible.length === 0 ? <p className="text-ink-3">No hay sesiones con este filtro.</p> : null}
          <ul data-tour="history-list" className="m-0 flex list-none flex-col gap-2 p-0 lg:glass lg:gap-1 lg:rounded-[26px] lg:p-2.5">
            {visible.map((r) => {
              const on = isDesktop && current?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => select(r.id)}
                    aria-current={on ? "true" : undefined}
                    aria-label={`${whenShort(r.endedAt)}, ${statusText(r).toLowerCase()}, ${r.config.intention || "sin intención escrita"}, código ${r.config.code}${r.config.codeName ? `, ${r.config.codeName}` : ""}`}
                    className={clsx(
                      "flex w-full items-center gap-3.5 rounded-[18px] border px-4 py-3 text-left text-ink transition-colors",
                      on ? "border-turq/35 bg-gradient-to-r from-turq-deep/[0.14] to-turq-deep/[0.04]" : "glass border-white/[0.08] lg:border-transparent lg:bg-none lg:shadow-none lg:hover:bg-white/[0.035]",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className={clsx("truncate text-[15px] font-medium", !r.config.intention && "text-ink-3")}>{r.config.intention || "Sin intención escrita"}</span>
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
                        <StatusDot record={r} />
                        <span>{whenShort(r.endedAt)}</span>
                        <span>{formatClock(r.elapsedMs)}</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-[15px] font-medium tracking-[0.14em]">{r.config.code}</span>
                      {r.config.codeName ? <span className="max-w-[128px] truncate text-[12.5px] font-medium text-copper-light">{r.config.codeName}</span> : null}
                    </span>
                    {!isDesktop ? <IconChevronRight size={18} className="text-ink-3" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {isDesktop && current ? (
          <section aria-label="Detalle de la sesión" data-tour="history-detail" className="min-w-0 flex-[2_1_360px]">
            <RecordDetail key={current.id} record={current} onDeleted={() => router.replace(pathname, { scroll: false })} />
          </section>
        ) : null}
      </div>
    </Wrap>
  );
}

function Wrap({ children, actions, title }: { children: React.ReactNode; actions?: React.ReactNode; title?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 pb-[120px] lg:px-9 lg:pb-10 lg:pt-6">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 lg:pb-5">
        {title ?? <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em] lg:text-[32px] lg:tracking-[-0.03em]">Historial</h1>}
        {actions}
      </header>
      {children}
    </div>
  );
}

function StatusDot({ record }: { record: SessionRecord }) {
  const done = record.status === "completed";
  return (
    <span className={clsx("inline-flex items-center gap-1.5 font-semibold", done ? "text-turq" : "text-amber")}>
      <span className={clsx("h-2 w-2 rounded-full", done ? "bg-turq" : "bg-amber")} />
      {statusText(record)}
    </span>
  );
}

function statusText(r: SessionRecord): string {
  return r.status === "completed" ? "Completada" : "Finalizada antes";
}

const timeFmt = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const longFmt = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function whenShort(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hoy ${timeFmt.format(d)}`;
  if (d.toDateString() === yest.toDateString()) return `Ayer ${timeFmt.format(d)}`;
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

function RecordDetail({ record, onDeleted }: { record: SessionRecord; onDeleted: () => void }) {
  const router = useRouter();
  const announce = useAnnounce();
  const noteId = useId();
  const [note, setNote] = useState(record.note);
  // Versión guardada sobre la que se edita. Si otra pestaña la cambia y aquí nadie escribió, se adopta.
  const [base, setBase] = useState(record.note);
  if (record.note !== base && note === base) {
    setBase(record.note);
    setNote(record.note);
  }
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "missing" | "conflict">("idle");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const url = useObjectUrl(blob);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const done = record.status === "completed";
  const imageId = record.config.witness.imageId;

  useEffect(() => {
    let alive = true;
    if (imageId) void getImageBlob(imageId).then((b) => alive && setBlob(b)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [imageId]);

  async function save() {
    setSaveState("saving");
    try {
      const updated = await saveNote(record.id, note, { expected: base });
      setBase(updated.note);
      setNote(updated.note);
      setSaveState("saved");
    } catch (e) {
      if (e instanceof NoteConflict) {
        setBase(e.current);
        setSaveState("conflict");
      } else {
        setSaveState(e instanceof RecordMissing ? "missing" : "error");
      }
    }
  }

  async function reuse() {
    setError(null);
    try {
      await draftFromRecord(record);
      router.push("/tablero");
    } catch {
      setError("No se pudo cargar la configuración en el Tablero. Inténtalo de nuevo.");
    }
  }

  async function remove() {
    setConfirm(false);
    try {
      await deleteRecord(record.id);
      announce("Registro eliminado.");
      onDeleted();
    } catch {
      setError("No se pudo eliminar el registro. Inténtalo de nuevo.");
    }
  }

  const frac = record.durationMs ? record.elapsedMs / record.durationMs : 1;
  const C = 333.01;
  return (
    <article className="glass relative flex flex-col gap-[18px] overflow-hidden rounded-[26px] p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-28 h-[340px] w-[340px]" style={{ background: `radial-gradient(circle, ${done ? "rgba(60,207,192,0.16)" : "rgba(227,168,74,0.14)"}, rgba(0,0,0,0) 62%)` }} />
      <div className="relative flex items-center gap-[18px]">
        <svg width="104" height="104" viewBox="0 0 116 116" aria-hidden="true" className="shrink-0">
          <defs>
            <linearGradient id="cu-hd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ECBF92" /><stop offset="1" stopColor="#8A5634" /></linearGradient>
          </defs>
          <circle cx="58" cy="58" r="53" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle cx="58" cy="58" r="53" fill="none" stroke="url(#cu-hd)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={(C * (1 - frac)).toFixed(2)} transform="rotate(-90 58 58)" />
          <polygon points={codeFigurePoints(record.config.code, 58, 58, 7, 4.6)} fill="#3CCFC0" fillOpacity="0.16" stroke="#8CF0E5" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="inline-flex h-[30px] items-center self-start rounded-full border border-white/10 bg-white/5 px-3 text-[13px]">
            <StatusDot record={record} />
          </span>
          <h2 ref={headingRef} tabIndex={-1} className="m-0 text-[32px] font-light leading-none tracking-[0.14em] outline-none">{record.config.code}</h2>
          {record.config.codeName ? <span className="text-[15px] font-semibold text-copper-pale">{record.config.codeName}</span> : null}
          <span className="text-sm text-ink-3 first-letter:uppercase">{longFmt.format(new Date(record.endedAt))}</span>
        </div>
      </div>
      <dl className="relative m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 rounded-[18px] bg-white/[0.035] px-[18px] py-4">
        <dt className="text-[13px] text-ink-3">Duración</dt>
        <dd className="m-0 text-[15px]">{done ? formatClock(record.durationMs) : `${formatClock(record.elapsedMs)} de ${formatClock(record.durationMs)}`}</dd>
        <dt className="text-[13px] text-ink-3">Intención</dt>
        <dd className={clsx("m-0 text-[15px] leading-snug", !record.config.intention && "text-ink-3")}>{record.config.intention || "Sin intención escrita"}</dd>
        <dt className="text-[13px] text-ink-3">Testigo</dt>
        <dd className="m-0 flex items-center gap-2.5 text-[15px]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={record.config.witness.alias ? `Imagen del testigo «${record.config.witness.alias}»` : "Imagen del testigo"} className="h-10 w-10 rounded-[10px] border border-white/10 object-cover" />
          ) : null}
          {record.config.witness.alias || (imageId ? "Con imagen" : <span className="text-ink-3">Sin testigo</span>)}
        </dd>
        <dt className="text-[13px] text-ink-3">Sonido</dt>
        <dd className="m-0 text-[15px]">{record.config.tone ? `${record.config.tone} Hz` : "Sin sonido"}</dd>
        {record.config.presetName ? (
          <>
            <dt className="text-[13px] text-ink-3">Preset</dt>
            <dd className="m-0 text-[15px]">{record.config.presetName}</dd>
          </>
        ) : null}
      </dl>
      <div className="relative flex flex-col gap-2">
        <label htmlFor={noteId} className="text-sm font-medium">Nota</label>
        <textarea
          id={noteId}
          className="field resize-y"
          rows={3}
          maxLength={2000}
          value={note}
          placeholder="Añade una nota sobre esta sesión"
          onChange={(e) => {
            setNote(e.target.value);
            if (saveState !== "saving") setSaveState("idle");
          }}
        />
        <div className="flex items-center gap-3">
          <button type="button" className="btn-soft" onClick={() => void save()} disabled={saveState === "saving" || note === base}>
            {base ? "Guardar cambios" : "Guardar nota"}
          </button>
          <span role="status" className="text-[13px] text-ink-3">
            {saveState === "saved"
              ? "Nota guardada."
              : saveState === "error"
                ? "No se pudo guardar. Tu texto sigue aquí."
                : saveState === "missing"
                  ? "Este registro ya no existe."
                  : saveState === "conflict"
                    ? "La nota cambió en otra pestaña. Tu texto sigue aquí; si lo guardas, la reemplaza."
                    : ""}
          </span>
        </div>
      </div>
      {error ? <p role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
      <div className="relative flex flex-wrap items-center gap-3">
        <button type="button" className="btn-go flex-[1_1_200px]" onClick={() => void reuse()}>
          <IconRepeat size={18} />
          Reutilizar configuración
        </button>
        <button type="button" className="btn-link !min-h-[52px] !px-4 !text-[15px] !font-semibold !text-danger" onClick={() => setConfirm(true)}>
          <IconTrash size={18} />
          Eliminar
        </button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        role="alertdialog"
        title="¿Eliminar este registro?"
        description={`Se borrará la sesión del ${longFmt.format(new Date(record.endedAt))} y su imagen del testigo. No se puede deshacer.`}
      >
        <div className="flex gap-3">
          <button type="button" className="btn-glass flex-1" onClick={() => setConfirm(false)}>Cancelar</button>
          <button type="button" className="btn-del flex-1" onClick={() => void remove()}>Eliminar</button>
        </div>
      </Modal>
    </article>
  );
}
