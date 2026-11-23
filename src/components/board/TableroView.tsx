"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { codeToDials, dialsToCode, isValidCode } from "@/domain/code";
import { formatClock, remainingMs } from "@/domain/timer";
import { MAX_DURATION, MIN_DURATION, clampDuration, type Draft, type SessionConfig } from "@/domain/types";
import { toneEngine } from "@/audio/engine";
import { getDraft, getSettings, updateDraft } from "@/storage/kv";
import { savePreset, validatePreset } from "@/storage/presets";
import { ActiveSessionExists, getActive, getPendingNote, startSession } from "@/storage/sessions";
import { useLive } from "@/hooks/useLive";
import { useIsDesktop, useNow, useObjectUrl } from "@/hooks/misc";
import { useAnnounce } from "@/components/Announcer";
import { Modal } from "@/components/Modal";
import { Toast, type ToastData } from "@/components/Toast";
import { HelpSteps } from "@/components/HelpText";
import { CodeEditor } from "./CodeEditor";
import { WitnessEditor } from "./WitnessEditor";
import { IconAlert, IconBookmarkPlus, IconChevronRight, IconClock, IconHelp, IconImage, IconMinus, IconPen, IconPlay, IconPlus, IconVolume } from "@/components/Icons";

type Sheet = null | "intent" | "witness" | "preset" | "help";

export function TableroView() {
  const router = useRouter();
  const announce = useAnnounce();
  const isDesktop = useIsDesktop();
  const settings = useLive(["settings"], getSettings);
  const active = useLive(["active"], getActive);
  const pending = useLive(["history", "active"], getPendingNote);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [codeValid, setCodeValid] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const draftRef = useRef<Draft | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const fetchDraft = useCallback(() => {
    getDraft()
      .then((d) => {
        draftRef.current = d;
        setDraft(d);
      })
      .catch(() => setLoadError("No se pudo abrir el almacenamiento local de este navegador."));
  }, []);
  useEffect(fetchDraft, [fetchDraft]);
  const load = () => {
    setLoadError(null);
    fetchDraft();
  };

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const d = draftRef.current;
    if (!d || !dirty.current) return;
    dirty.current = false;
    await updateDraft({ config: d.config, image: d.image });
  }, []);

  useEffect(() => {
    const onHide = () => void flush().catch(() => undefined);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush().catch(() => undefined);
    };
  }, [flush]);

  const change = useCallback(
    (fn: (d: Draft) => Draft) => {
      const cur = draftRef.current;
      if (!cur) return;
      const next = fn(cur);
      draftRef.current = next;
      setDraft(next);
      dirty.current = true;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush().catch(() => undefined), 300);
    },
    [flush],
  );

  const patch = useCallback(
    (c: Partial<SessionConfig>) =>
      change((d) => {
        const touchesPreset = "code" in c || "durationMin" in c || "tone" in c;
        return {
          ...d,
          config: {
            ...d.config,
            ...c,
            witness: { ...d.config.witness, ...c.witness },
            ...(touchesPreset && !("presetId" in c) ? { presetId: undefined, presetName: undefined } : {}),
          },
        };
      }),
    [change],
  );

  const onValidity = useCallback((v: boolean) => setCodeValid(v), []);
  const hasActive = !!active.data;
  const canStart = !!draft && codeValid && isValidCode(draft.config.code) && !hasActive && !starting;

  async function start() {
    const d = draftRef.current;
    if (!d || !canStart) return;
    if (d.config.tone !== null) toneEngine.unlock(); // dentro del gesto
    setStarting(true);
    setStartError(null);
    try {
      dirty.current = true;
      await flush();
      await startSession(draftRef.current ?? d, { soundOn: d.config.tone !== null });
      // Pedir almacenamiento persistente al guardar la primera sesión (fuera de la transacción).
      void navigator.storage?.persist?.().catch(() => undefined);
      announce("Sesión iniciada.");
      router.push("/sesion");
    } catch (e) {
      setStartError(
        e instanceof ActiveSessionExists
          ? "Ya hay una sesión en curso. Termínala para iniciar otra."
          : "No se pudo iniciar la sesión. Puede que el almacenamiento esté lleno; inténtalo de nuevo.",
      );
      setStarting(false);
    }
  }

  if (loadError) {
    return (
      <Shell onHelp={() => setSheet("help")}>
        <div role="alert" className="glass flex flex-col gap-3 rounded-[22px] p-5">
          <p className="m-0 flex items-center gap-2 font-semibold text-danger">
            <IconAlert size={18} /> {loadError}
          </p>
          <p className="m-0 text-sm text-ink-2">Puede pasar en ventanas privadas o si el navegador bloquea los datos del sitio.</p>
          <button type="button" className="btn-glass self-start" onClick={load}>
            Reintentar
          </button>
        </div>
      </Shell>
    );
  }

  if (!draft) {
    return <Shell onHelp={() => setSheet("help")}><p className="text-ink-3">Cargando…</p></Shell>;
  }

  const dials = codeToDials(draft.config.code);
  const tone = draft.config.tone;
  const soundText = tone !== null ? `Tono de ${tone} Hz · volumen bajo` : "Apagado";

  const banners = (
    <>
      {active.data ? <ActiveBanner session={active.data} /> : null}
      {!active.data && pending.data ? (
        <Link href="/sesion" className="glass flex items-center gap-3 rounded-[20px] px-4 py-3 text-ink no-underline">
          <span className="h-2 w-2 shrink-0 rounded-full bg-turq shadow-[0_0_10px_#6BE4D7]" />
          <span className="flex-1 text-[15px]">
            Tu sesión terminó.{" "}
            <span className="text-ink-2">{pending.data.status === "completed" ? "Se completó" : "Finalizó antes"}; puedes dejar una nota.</span>
          </span>
          <span className="font-semibold text-turq">Añadir nota</span>
        </Link>
      ) : null}
      {startError ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-sm text-danger">
          <IconAlert size={16} /> {startError}
        </p>
      ) : null}
    </>
  );

  const startButton = (
    <button type="button" className="btn-go flex-1" onClick={() => void start()} disabled={!canStart} aria-describedby={hasActive ? "inicio-bloqueado" : undefined}>
      <IconPlay />
      {starting ? "Iniciando…" : isDesktop ? `Iniciar sesión · ${draft.config.durationMin} min` : "Iniciar sesión"}
    </button>
  );

  return (
    <Shell onHelp={() => setSheet("help")}>
      <div className="flex flex-col gap-4">{banners}</div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <section aria-label="Código y diales" className="relative lg:glass lg:rounded-[28px] lg:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[52%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2"
            style={{ background: "radial-gradient(circle, rgba(60,207,192,0.18) 0%, rgba(60,207,192,0.05) 38%, rgba(60,207,192,0) 64%)" }}
          />
          <div className="relative">
            <CodeEditor
              dials={dials}
              large={isDesktop}
              onValidityChange={onValidity}
              onChange={(next) => patch({ code: dialsToCode(next) })}
            />
          </div>
        </section>

        <section aria-labelledby="t-sesion" className="flex flex-col gap-4 lg:glass lg:rounded-[28px] lg:p-7">
          <h2 id="t-sesion" className="m-0 hidden text-xl font-semibold tracking-[-0.02em] lg:block">
            Sesión
          </h2>

          {isDesktop ? (
            <>
              <IntentionInline value={draft.config.intention} onChange={(v) => patch({ intention: v })} />
              <DurationField value={draft.config.durationMin} onChange={(m) => patch({ durationMin: m })} chips />
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  Testigo <span className="font-normal text-ink-3">· opcional, una referencia de la sesión</span>
                </span>
                <WitnessEditor
                  alias={draft.config.witness.alias}
                  image={draft.image}
                  onAlias={(a) => patch({ witness: { alias: a } })}
                  onImage={(img) => change((d) => ({ ...d, image: img }))}
                />
              </div>
              <SoundRow on={tone !== null} text={soundText} onToggle={() => {
                if (tone === null) toneEngine.unlock();
                patch({ tone: tone === null ? settings.data?.tone ?? 432 : null });
              }} />
              <div className="mt-2 flex flex-col gap-2.5">
                {startButton}
                <button type="button" className="btn-glass" onClick={() => setSheet("preset")} disabled={!codeValid}>
                  <IconBookmarkPlus size={18} />
                  Guardar como preset
                </button>
              </div>
            </>
          ) : (
            <div className="glass overflow-hidden rounded-[22px] py-1">
              <RowButton icon={<IconPen size={18} />} title="Intención" detail={draft.config.intention || "Añade una intención"} muted={!draft.config.intention} onClick={() => setSheet("intent")} />
              <Sep />
              <div className="flex min-h-16 items-center gap-3.5 px-4 py-2.5">
                <span className="ico"><IconClock size={18} /></span>
                <DurationField value={draft.config.durationMin} onChange={(m) => patch({ durationMin: m })} />
              </div>
              <Sep />
              <WitnessRow draft={draft} onClick={() => setSheet("witness")} />
              <Sep />
              <div className="px-4 py-1">
                <SoundRow compact on={tone !== null} text={soundText} onToggle={() => {
                  if (tone === null) toneEngine.unlock();
                  patch({ tone: tone === null ? settings.data?.tone ?? 432 : null });
                }} />
              </div>
            </div>
          )}
          {hasActive ? (
            <p id="inicio-bloqueado" className="m-0 text-[13px] text-ink-3">Termina la sesión en curso para iniciar otra.</p>
          ) : null}
        </section>
      </div>

      {!isDesktop ? (
        <>
          <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[210px] bg-gradient-to-b from-transparent via-carbon/90 to-carbon" />
          <div className="fixed inset-x-4 bottom-[96px] z-20 flex items-center gap-3">
            <button type="button" className="round !h-14 !w-14" aria-label="Guardar como preset" onClick={() => setSheet("preset")} disabled={!codeValid}>
              <IconBookmarkPlus size={22} />
            </button>
            {startButton}
          </div>
        </>
      ) : null}

      <Modal open={sheet === "intent"} onClose={() => setSheet(null)} title="Intención">
        <IntentionSheet value={draft.config.intention} onChange={(v) => patch({ intention: v })} onDone={() => setSheet(null)} />
      </Modal>
      <Modal open={sheet === "witness"} onClose={() => setSheet(null)} title="Testigo">
        <WitnessEditor
          alias={draft.config.witness.alias}
          image={draft.image}
          onAlias={(a) => patch({ witness: { alias: a } })}
          onImage={(img) => change((d) => ({ ...d, image: img }))}
        />
        <button type="button" className="btn-go" onClick={() => setSheet(null)}>Listo</button>
      </Modal>
      <SavePresetModal
        key={sheet === "preset" ? "abierto" : "cerrado"}
        open={sheet === "preset"}
        onClose={() => setSheet(null)}
        config={draft.config}
        onSaved={(name) => {
          setSheet(null);
          setToast({ text: `Preset «${name}» guardado`, href: "/presets", linkText: "Ver presets" });
        }}
      />
      <Modal open={sheet === "help"} onClose={() => setSheet(null)} title="Ayuda">
        <HelpSteps />
        <button type="button" className="btn-go" onClick={() => setSheet(null)}>Entendido</button>
      </Modal>

      <Toast toast={toast} onDone={() => setToast(null)} className="inset-x-4 bottom-[166px] lg:inset-x-auto lg:bottom-7 lg:right-9" />
    </Shell>
  );
}

function Shell({ children, onHelp }: { children: React.ReactNode; onHelp: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 pb-[200px] lg:px-9 lg:pb-10 lg:pt-6">
      <header className="flex h-[60px] items-center justify-between lg:h-auto lg:pb-5">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em] lg:text-[32px] lg:tracking-[-0.03em]">Tablero</h1>
        <button type="button" className="round sm lg:!h-11 lg:!w-auto lg:gap-2 lg:!rounded-[22px] lg:!px-4" aria-label="Ayuda" onClick={onHelp}>
          <IconHelp size={20} />
          <span className="hidden text-[15px] lg:inline" aria-hidden="true">Ayuda</span>
        </button>
      </header>
      {children}
    </div>
  );
}

function ActiveBanner({ session }: { session: NonNullable<Awaited<ReturnType<typeof getActive>>> }) {
  const now = useNow(session.status === "running", 1000);
  const rest = remainingMs(session, now);
  return (
    <div className="glass flex items-center gap-3 rounded-[20px] px-4 py-3">
      <span className={clsx("h-2 w-2 shrink-0 rounded-full", session.status === "running" ? "bg-turq shadow-[0_0_10px_#6BE4D7]" : "bg-amber")} />
      <span className="flex-1 text-[15px]">
        Sesión {session.status === "running" ? "en curso" : "en pausa"} · <span className="text-ink-2">Quedan {formatClock(rest)}</span>
      </span>
      <Link href="/sesion" className="btn-soft no-underline">Volver</Link>
    </div>
  );
}

function Sep() {
  return <div className="ml-[66px] h-px bg-white/[0.06]" />;
}

function RowButton({ icon, title, detail, muted, onClick }: { icon: React.ReactNode; title: string; detail: string; muted?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3.5 bg-transparent px-4 py-2.5 text-left text-ink hover:bg-white/[0.03]">
      <span className="ico">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium">{title}</span>
        <span className={clsx("truncate text-sm", muted ? "text-ink-3" : "text-ink-2")}>{detail}</span>
      </span>
      <IconChevronRight size={18} className="text-ink-3" />
    </button>
  );
}

function WitnessRow({ draft, onClick }: { draft: Draft; onClick: () => void }) {
  const url = useObjectUrl(draft.image?.blob);
  const alias = draft.config.witness.alias;
  const detail = alias && draft.image ? `${alias} · con imagen` : alias || (draft.image ? "Con imagen" : "Sin testigo");
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3.5 bg-transparent px-4 py-2.5 text-left text-ink hover:bg-white/[0.03]">
      <span className="ico"><IconImage size={18} /></span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium">
          Testigo <span className="font-normal text-ink-3">· opcional</span>
        </span>
        <span className={clsx("truncate text-sm", alias || draft.image ? "text-ink-2" : "text-ink-3")}>{detail}</span>
      </span>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-9 w-9 rounded-[10px] border border-white/10 object-cover" />
      ) : (
        <IconChevronRight size={18} className="text-ink-3" />
      )}
    </button>
  );
}

function DurationField({ value, onChange, chips }: { value: number; onChange: (m: number) => void; chips?: boolean }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={clsx("flex flex-1 flex-col gap-2.5", !chips && "flex-row items-center")}>
      <span id={id} className={clsx("font-medium", chips ? "text-sm" : "flex-1 text-[15px]")}>Duración</span>
      <div className="flex items-center gap-3">
        <button type="button" className="round sm" aria-label="Restar un minuto" disabled={value <= MIN_DURATION} onClick={() => onChange(clampDuration(value - 1))}>
          <IconMinus size={18} />
        </button>
        <output aria-live="off" className="min-w-[64px] text-center text-[17px] font-medium">
          {value} <span className="text-sm font-normal text-ink-3">min</span>
        </output>
        <button type="button" className="round sm" aria-label="Sumar un minuto" disabled={value >= MAX_DURATION} onClick={() => onChange(clampDuration(value + 1))}>
          <IconPlus size={18} />
        </button>
      </div>
      {chips ? (
          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 15, 20, 30].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={value === m}
                onClick={() => onChange(m)}
                className={clsx(
                  "min-h-11 rounded-[16px] border px-3 text-sm font-medium",
                  value === m ? "border-turq/50 bg-turq-deep/15 text-turq" : "border-white/10 bg-white/[0.04] text-ink-2 hover:bg-white/[0.08]",
                )}
              >
                {m} min
              </button>
            ))}
          </div>
        ) : null}
    </div>
  );
}

function SoundRow({ on, text, onToggle, compact }: { on: boolean; text: string; onToggle: () => void; compact?: boolean }) {
  const id = useId();
  return (
    <div className={clsx("flex items-center gap-3.5", compact ? "min-h-14" : "")}>
      {compact ? <span className="ico"><IconVolume size={18} /></span> : null}
      <div className="flex flex-1 flex-col gap-0.5">
        <span id={id} className="text-[15px] font-medium">Sonido ambiental</span>
        <span className="text-[13px] text-ink-3">{text}</span>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="switch" onClick={onToggle}>
        <span className="tr"><span className="kn" /></span>
      </button>
    </div>
  );
}

function IntentionInline({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">Intención</label>
      <textarea id={id} className="field resize-none" rows={3} maxLength={280} value={value} placeholder="¿Qué quieres sostener en esta sesión?" onChange={(e) => onChange(e.target.value)} />
      <span className="text-[13px] text-ink-3">Se guarda en la ficha de la sesión, no en el preset.</span>
    </div>
  );
}

function IntentionSheet({ value, onChange, onDone }: { value: string; onChange: (v: string) => void; onDone: () => void }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">Intención</label>
      <textarea id={id} className="field resize-none" rows={4} maxLength={280} autoFocus value={value} placeholder="¿Qué quieres sostener en esta sesión?" onChange={(e) => onChange(e.target.value)} />
      <p className="m-0 text-[13px] text-ink-3">Se guarda en la ficha de la sesión, no en el preset.</p>
      <button type="button" className="btn-go" onClick={onDone}>Listo</button>
    </>
  );
}

function SavePresetModal({ open, onClose, config, onSaved }: { open: boolean; onClose: () => void; config: SessionConfig; onSaved: (name: string) => void }) {
  const id = useId();
  const errId = useId();
  // Se monta de nuevo en cada apertura (key), así parte del nombre del preset aplicado.
  const [name, setName] = useState(config.presetName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const input = { name, code: config.code, durationMin: config.durationMin, tone: config.tone };
    const errs = validatePreset(input);
    if (errs.name || errs.code) {
      setError(errs.name ?? errs.code ?? null);
      return;
    }
    setBusy(true);
    try {
      const p = await savePreset(input);
      onSaved(p.name);
    } catch {
      setError("No se pudo guardar el preset. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Guardar como preset">
      <label htmlFor={id} className="text-sm font-medium">Nombre del preset</label>
      <input
        id={id}
        className="field"
        type="text"
        maxLength={60}
        autoFocus
        value={name}
        placeholder="Por ejemplo «Mañana tranquila»"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
      />
      {error ? <p id={errId} role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-2.5 rounded-2xl bg-white/[0.035] px-4 py-3.5">
        <dt className="text-[13px] text-ink-3">Código</dt>
        <dd className="m-0 text-base font-medium tracking-[0.16em]">{config.code}</dd>
        <dt className="text-[13px] text-ink-3">Duración</dt>
        <dd className="m-0 text-[15px]">{config.durationMin} min</dd>
        <dt className="text-[13px] text-ink-3">Tono</dt>
        <dd className="m-0 text-[15px]">{config.tone ? `${config.tone} Hz` : "Sin sonido"}</dd>
      </dl>
      <p className="m-0 text-[13px] leading-snug text-ink-3">La intención y el testigo no se guardan en el preset: son de cada sesión.</p>
      <div className="flex gap-3">
        <button type="button" className="btn-glass" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn-go flex-1" onClick={() => void save()} disabled={busy}>Guardar preset</button>
      </div>
    </Modal>
  );
}
