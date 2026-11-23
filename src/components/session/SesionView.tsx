"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { codeFigurePoints } from "@/domain/code";
import { formatClock, remainingMs } from "@/domain/timer";
import type { ActiveSession, SessionRecord } from "@/domain/types";
import { toneEngine, type AudioState } from "@/audio/engine";
import { getSettings } from "@/storage/kv";
import {
  NoteConflict,
  StaleAction,
  dismissPendingNote,
  rebaseRunning,
  finishEarly,
  getActive,
  getImageBlob,
  getPendingNote,
  pauseSession,
  reconcileExpired,
  resumeSession,
  saveNote,
  setSessionSound,
  type TransitionResult,
} from "@/storage/sessions";
import { useLive } from "@/hooks/useLive";
import { useDocumentVisible, useNow, useObjectUrl, useReducedMotion } from "@/hooks/misc";
import { useAnnounce } from "@/components/Announcer";
import { useGuide } from "@/guide/useGuide";
import { Modal } from "@/components/Modal";
import { IconAlert, IconChevronLeft, IconPause, IconPlay, IconStop, IconVolume, IconVolumeOff } from "@/components/Icons";

const CIRC = 2 * Math.PI * 128;

export function SesionView() {
  const announce = useAnnounce();
  const active = useLive(["active"], getActive);
  const settings = useLive(["settings"], getSettings);
  const pending = useLive(["history", "active"], getPendingNote);
  const [ended, setEnded] = useState<SessionRecord | null>(null);
  const [failure, setFailure] = useState<null | { message: string; retry?: () => void; action?: { label: string; fn: () => Promise<TransitionResult> } }>(null);
  // La confirmación queda atada a la sesión y revisión con las que se abrió.
  const [confirmFor, setConfirmFor] = useState<{ id: string; rev: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const s = active.data ?? null;
  const running = s?.status === "running";
  const now = useNow(running, 250);
  const rest = s ? remainingMs(s, now) : 0;
  const visible = useDocumentVisible();
  const reduced = useReducedMotion();
  const openGuide = useGuide("sesion", !!active.data);
  const confirmOpen = !!confirmFor && !!s && confirmFor.id === s.id && confirmFor.rev === s.rev;

  // Si el reloj del sistema retrocede con la sesión abierta, se ancla el restante al reloj monotónico.
  const clockRef = useRef<{ wall: number; perf: number; rest: number } | null>(null);
  useEffect(() => {
    if (!s || s.status !== "running") {
      clockRef.current = null;
      return;
    }
    const wall = Date.now();
    const perf = performance.now();
    const prev = clockRef.current;
    if (prev && wall - prev.wall < perf - prev.perf - 2000) {
      const rest = Math.max(0, prev.rest - (perf - prev.perf));
      clockRef.current = { wall, perf, rest };
      void rebaseRunning({ id: s.id, rev: s.rev }, rest, wall).catch(() => undefined);
      return;
    }
    clockRef.current = { wall, perf, rest: remainingMs(s, wall) };
  }, [now, s]);
  const motionOff = reduced || settings.data?.animations === false;
  const audio = useSyncExternalStore(
    (cb) => toneEngine.subscribe(cb),
    () => toneEngine.current,
    () => "off" as AudioState,
  );

  // Una sesión que terminó mientras no se miraba se muestra para dejar la nota; al actuar sobre ella queda fijada.
  const closing: SessionRecord | null = ended ?? (!s && !active.loading ? pending.data ?? null : null);
  const reloadActive = active.reload;

  // Anuncios: una vez por transición efectiva, venga de esta pestaña o de otra.
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const key = s ? `${s.id}:${s.status}` : closing ? `fin:${closing.id}` : "vacio";
    const before = prev.current;
    prev.current = key;
    if (before === null || before === key) return;
    if (s && s.status === "paused") announce("Sesión en pausa.");
    else if (s && s.status === "running" && before.startsWith(`${s.id}:paused`)) announce("Sesión reanudada.");
    else if (closing) announce(closing.status === "completed" ? "Sesión completada. Puedes añadir una nota." : "Sesión finalizada antes del límite. Puedes añadir una nota.");
  }, [s, closing, announce]);

  const handle = useCallback((r: TransitionResult) => {
    if (r.kind === "ended") {
      toneEngine.stop();
      setEnded(r.record);
    }
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<TransitionResult>) => {
      setBusy(true);
      setFailure(null);
      try {
        handle(await fn());
      } catch (e) {
        if (e instanceof StaleAction) reloadActive();
        else setFailure({ message: `No se pudo ${label}. La sesión sigue a salvo en este dispositivo.`, action: { label, fn } });
      } finally {
        setBusy(false);
      }
    },
    [reloadActive, handle],
  );

  // Vencimiento con la vista abierta: silencio inmediato y paso al historial una sola vez.
  const expired = !!s && running && rest === 0;
  const sessionId = s?.id;
  useEffect(() => {
    if (!expired || !sessionId) return;
    toneEngine.stop();
    const attempt = () => {
      reconcileExpired()
        .then((rec) => {
          setFailure(null);
          if (rec && rec.id === sessionId) setEnded(rec);
          else reloadActive();
        })
        .catch(() => setFailure({ message: "No se guardó en el historial. La sesión sigue a salvo en este dispositivo; puede que el almacenamiento esté lleno.", retry: attempt }));
    };
    attempt();
  }, [expired, sessionId, reloadActive]);

  // Audio: suena solo con la sesión en curso, el sonido activo y la pestaña visible.
  const tone = s?.config.tone ?? null;
  const volume = settings.data?.volume ?? 0.2;
  const shouldPlay = !!s && running && s.soundOn && tone !== null && visible && rest > 0;
  useEffect(() => {
    if (shouldPlay && tone !== null) void toneEngine.play(tone, volume);
    else toneEngine.stop();
  }, [shouldPlay, tone, volume]);
  useEffect(() => {
    const stop = () => toneEngine.stop();
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      toneEngine.stop(); // al abandonar la vista
    };
  }, []);

  if (active.error) {
    return (
      <Frame>
        <ErrorBox message="No se pudo leer la sesión del almacenamiento local." onRetry={active.reload} />
      </Frame>
    );
  }
  if (active.loading && !s) return <Frame><p className="text-ink-3">Cargando…</p></Frame>;

  if (closing) return <Closing record={closing} onPin={setEnded} />;

  if (!s) {
    return (
      <Frame>
        <div className="glass mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-[28px] p-8 text-center">
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em]">No hay ninguna sesión en curso</h1>
          <p className="m-0 text-ink-2">Prepara el código y la intención en el Tablero para empezar.</p>
          <Link href="/tablero" className="btn-go no-underline">Ir al Tablero</Link>
        </div>
      </Frame>
    );
  }

  const expect = { id: s.id, rev: s.rev };
  const total = s.durationMs;
  const frac = total > 0 ? 1 - rest / total : 1;
  const chip = running ? "En curso" : "En pausa";

  return (
    <Frame onGuide={(el) => openGuide(el)}>
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <section aria-label="Tiempo de la sesión" data-tour="session-timer" className="flex flex-col items-center gap-3">
          <span className={clsx("inline-flex h-[30px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-[13px] font-semibold", running ? "text-turq" : "text-amber")}>
            <span className={clsx("h-[7px] w-[7px] rounded-full", running ? "bg-turq shadow-[0_0_10px_#6BE4D7]" : "bg-amber")} />
            {chip}
          </span>
          <div className={clsx("relative aspect-square w-[min(250px,68vw)] lg:w-[380px]", motionOff && "motion-off")}>
            <div aria-hidden="true" className="absolute inset-[-12%]" style={{ background: "radial-gradient(circle, rgba(60,207,192,0.18), rgba(60,207,192,0) 62%)" }} />
            <svg viewBox="0 0 280 280" className="relative h-full w-full" aria-hidden="true">
              <defs>
                <linearGradient id="cu-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ECBF92" />
                  <stop offset="1" stopColor="#8A5634" />
                </linearGradient>
                <filter id="glow-fig" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="5" />
                </filter>
              </defs>
              <circle cx="140" cy="140" r="128" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="140"
                cy="140"
                r="128"
                fill="none"
                stroke="url(#cu-ring)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC.toFixed(2)}
                strokeDashoffset={(CIRC * (1 - frac)).toFixed(2)}
                transform="rotate(-90 140 140)"
                style={{ transition: "stroke-dashoffset 0.3s linear" }}
              />
              <g className={running ? "figure-spin" : undefined}>
                <g className={running ? "figure-breathe" : undefined}>
                  <polygon points={codeFigurePoints(s.config.code, 140, 140, 22, 9.5)} fill="#3CCFC0" fillOpacity="0.45" filter="url(#glow-fig)" />
                  <polygon points={codeFigurePoints(s.config.code, 140, 140, 22, 9.5)} fill="#3CCFC0" fillOpacity="0.16" stroke="#8CF0E5" strokeWidth="2" strokeLinejoin="round" />
                </g>
              </g>
            </svg>
          </div>
          <div role="timer" aria-live="off" aria-label={`Quedan ${formatClock(rest)} de ${formatClock(total)}`} className="flex flex-col items-center">
            <span className="text-[64px] font-extralight leading-none tracking-[-0.04em] lg:text-[96px]">{formatClock(rest)}</span>
            <span className="mt-1 text-[15px] text-ink-3">de {formatClock(total)}</span>
          </div>
        </section>

        <section aria-label="Resumen y controles" className="flex flex-col gap-5">
          <dl data-tour="session-summary" className="glass order-3 m-0 grid lg:order-none grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 rounded-[22px] px-5 py-4">
            <dt className="text-[13px] text-ink-3">Código</dt>
            <dd className="m-0 text-lg font-medium tracking-[0.16em]">{s.config.code}</dd>
            <dt className="text-[13px] text-ink-3">Duración</dt>
            <dd className="m-0 text-[15px]">{s.config.durationMin} min</dd>
            <dt className="text-[13px] text-ink-3">Intención</dt>
            <dd className={clsx("m-0 text-[15px] leading-snug", !s.config.intention && "text-ink-3")}>{s.config.intention || "Sin intención escrita"}</dd>
            <dt className="text-[13px] text-ink-3">Testigo</dt>
            <dd className="m-0"><WitnessSummary session={s} /></dd>
            <dt className="text-[13px] text-ink-3">Sonido</dt>
            <dd className="m-0 text-[15px]">{tone === null ? "Sin sonido" : s.soundOn ? `${tone} Hz` : `${tone} Hz · silenciado`}</dd>
          </dl>

          {tone !== null && s.soundOn && audio === "blocked" && running ? (
            <div className="glass flex items-center justify-between gap-3 rounded-[20px] px-4 py-3">
              <span className="text-sm text-ink-2">El navegador pausó el sonido.</span>
              <button
                type="button"
                className="btn-soft"
                onClick={() => {
                  toneEngine.unlock();
                  void toneEngine.play(tone, volume);
                }}
              >
                Activar audio
              </button>
            </div>
          ) : null}
          {tone !== null && s.soundOn && audio === "unavailable" ? (
            <p className="m-0 text-sm text-ink-3">Este dispositivo no puede reproducir el tono. La sesión sigue con normalidad.</p>
          ) : null}

          {failure ? (
            <ErrorBox
              message={failure.message}
              onRetry={() => {
                if (failure.action) void run(failure.action.label, failure.action.fn);
                else failure.retry?.();
              }}
            />
          ) : null}

          <div data-tour="session-controls" className="order-1 flex items-center justify-center gap-6 lg:order-none lg:justify-start">
            <div className="flex flex-col items-center gap-2">
              <button type="button" className="round !h-16 !w-16" onClick={() => setConfirmFor({ id: s.id, rev: s.rev })} disabled={busy} aria-label="Finalizar">
                <IconStop />
              </button>
              <span aria-hidden="true" className="text-[13px] text-ink-3">Finalizar</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              {running ? (
                <button type="button" className="btn-go !h-[88px] !w-[88px] !rounded-full !p-0" onClick={() => void run("pausar", () => pauseSession(expect))} disabled={busy} aria-label="Pausar">
                  <IconPause size={30} />
                </button>
              ) : (
                <button type="button" className="btn-go !h-[88px] !w-[88px] !rounded-full !p-0" onClick={() => void run("reanudar", () => resumeSession(expect))} disabled={busy} aria-label="Reanudar">
                  <IconPlay size={30} />
                </button>
              )}
              <span aria-hidden="true" className="text-[13px] text-ink-3">{running ? "Pausar" : "Reanudar"}</span>
            </div>
            {tone !== null ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  className="round !h-16 !w-16"
                  aria-pressed={s.soundOn}
                  aria-label="Sonido"
                  disabled={busy}
                  onClick={() => {
                    if (!s.soundOn) toneEngine.unlock();
                    void run("cambiar el sonido", () => setSessionSound(expect, !s.soundOn));
                  }}
                >
                  {s.soundOn ? <IconVolume size={22} /> : <IconVolumeOff size={22} />}
                </button>
                <span aria-hidden="true" className="text-[13px] text-ink-3">{s.soundOn ? "Sonido" : "Silencio"}</span>
              </div>
            ) : null}
          </div>
          <p className="order-2 m-0 text-center text-[13px] leading-snug text-ink-3 lg:order-none lg:text-left">
            Si cierras la pestaña, el tiempo sigue contando. Al volver verás el estado real de la sesión.
          </p>
        </section>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmFor(null)}
        title="¿Finalizar la sesión ahora?"
        role="alertdialog"
        description={`Quedan ${formatClock(rest)}. Se guardará en el historial como finalización anticipada y podrás añadir una nota.`}
      >
        <div className="flex gap-3">
          <button type="button" className="btn-glass flex-1" onClick={() => setConfirmFor(null)}>Seguir con la sesión</button>
          <button
            type="button"
            className="btn-go flex-1"
            onClick={() => {
              const target = confirmFor;
              setConfirmFor(null);
              // El tono se detiene cuando el cierre se confirma (handle), no antes: si falla, sigue sonando.
              if (target) void run("finalizar la sesión", () => finishEarly(target));
            }}
          >
            Finalizar ahora
          </button>
        </div>
      </Modal>
    </Frame>
  );
}

function Frame({ children, onGuide }: { children: React.ReactNode; onGuide?: (el: HTMLElement) => void }) {
  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 pb-10 lg:px-9 lg:pt-6">
      <header className="flex h-[60px] items-center justify-between">
        <Link href="/tablero" className="btn-link !text-ink-2">
          <IconChevronLeft size={18} />
          Tablero
        </Link>
        <h1 className="m-0 text-lg font-semibold tracking-[-0.02em] text-ink-2">Sesión</h1>
        {onGuide ? (
          <button type="button" className="btn-link w-[86px] justify-end !text-ink-2" onClick={(e) => onGuide(e.currentTarget)}>
            Guía
          </button>
        ) : (
          <span className="w-[86px]" aria-hidden="true" />
        )}
      </header>
      {children}
    </div>
  );
}

function WitnessSummary({ session }: { session: ActiveSession | SessionRecord }) {
  const imageId = session.config.witness.imageId;
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (!imageId) return;
    let alive = true;
    void getImageBlob(imageId).then((b) => alive && setBlob(b)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [imageId]);
  const url = useObjectUrl(imageId ? blob : null);
  const alias = session.config.witness.alias;
  if (!alias && !imageId) return <span className="text-[15px] text-ink-3">Sin testigo</span>;
  return (
    <span className="flex items-center gap-2.5 text-[15px]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alias ? `Imagen del testigo «${alias}»` : "Imagen del testigo"} className="h-10 w-10 rounded-[10px] border border-white/10 object-cover" />
      ) : null}
      {alias || "Con imagen"}
    </span>
  );
}

function Closing({ record, onPin }: { record: SessionRecord; onPin: (r: SessionRecord) => void }) {
  const id = useId();
  const [note, setNote] = useState(record.note);
  const [base, setBase] = useState(record.note);
  const [state, setState] = useState<"editing" | "saving" | "saved" | "skipped">(record.note ? "saved" : "editing");
  const [error, setError] = useState<string | null>(null);
  const done = record.status === "completed";
  const finalRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state === "saved" || state === "skipped") finalRef.current?.focus();
  }, [state]);

  async function save() {
    onPin(record);
    setState("saving");
    setError(null);
    try {
      await saveNote(record.id, note, { expected: base });
      setState("saved");
    } catch (e) {
      if (e instanceof NoteConflict) {
        setBase(e.current);
        setError("La nota cambió en otra pestaña. Tu texto sigue aquí; si lo guardas, la reemplaza.");
      } else {
        setError("No se pudo guardar la nota. Tu texto sigue aquí; inténtalo de nuevo.");
      }
      setState("editing");
    }
  }

  return (
    <Frame>
      <div className="glass relative mx-auto mt-4 flex max-w-xl flex-col gap-5 overflow-hidden rounded-[28px] p-6 lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-28 h-[340px] w-[340px]" style={{ background: `radial-gradient(circle, ${done ? "rgba(60,207,192,0.18)" : "rgba(227,168,74,0.16)"}, rgba(0,0,0,0) 62%)` }} />
        <div className="relative flex flex-col gap-1.5">
          <span className={clsx("text-[13px] font-semibold", done ? "text-turq" : "text-amber")}>{done ? "Completada" : "Finalizada antes"}</span>
          <h2 tabIndex={-1} ref={finalRef} className="m-0 text-[28px] font-semibold tracking-[-0.025em] outline-none">
            {state === "saved" || state === "skipped" ? "Guardada en el historial" : done ? "Sesión completada" : "Sesión finalizada antes"}
          </h2>
          <span className="text-[15px] text-ink-2">
            {formatClock(record.elapsedMs)} de {formatClock(record.durationMs)} · <span className="tracking-[0.14em]">{record.config.code}</span>
          </span>
        </div>

        {state === "editing" || state === "saving" ? (
          <div className="relative flex flex-col gap-3">
            <label htmlFor={id} className="text-sm font-medium">
              Nota <span className="font-normal text-ink-3">· opcional</span>
            </label>
            <textarea id={id} className="field resize-y" rows={4} maxLength={2000} value={note} onChange={(e) => {
              onPin(record); // escribir fija el cierre: otra sesión no lo reemplaza
              setNote(e.target.value);
            }} placeholder="¿Cómo fue la sesión?" />
            {error ? <p role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-glass"
                onClick={() => {
                  onPin(record);
                  void dismissPendingNote(record.id).catch(() => undefined);
                  setState("skipped");
                }}
              >
                Omitir
              </button>
              <button type="button" className="btn-go flex-1" onClick={() => void save()} disabled={state === "saving"}>
                {state === "saving" ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-wrap gap-3">
            <Link href={`/historial?id=${encodeURIComponent(record.id)}`} className="btn-glass no-underline">Ver historial</Link>
            <Link href="/tablero" className="btn-go no-underline">Volver al tablero</Link>
          </div>
        )}
      </div>
    </Frame>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[20px] border border-danger-strong/40 bg-danger-strong/10 p-4">
      <p className="m-0 flex items-start gap-2 text-[15px] text-ink">
        <IconAlert size={18} className="mt-0.5 shrink-0 text-danger" />
        {message}
      </p>
      <button type="button" className="btn-glass self-start !min-h-11" onClick={onRetry}>Reintentar</button>
    </div>
  );
}
