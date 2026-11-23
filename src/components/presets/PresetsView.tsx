"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { codeFigurePoints, parseCodeInput } from "@/domain/code";
import { TONES, type Preset, type Tone } from "@/domain/types";
import { deletePreset, listPresets, savePreset, validatePreset, type PresetValidation } from "@/storage/presets";
import { draftFromPreset } from "@/storage/kv";
import { useLive } from "@/hooks/useLive";
import { useIsDesktop } from "@/hooks/misc";
import { useAnnounce } from "@/components/Announcer";
import { Modal } from "@/components/Modal";
import { Toast, type ToastData } from "@/components/Toast";
import { IconPencil, IconPlus, IconTrash } from "@/components/Icons";

interface Editing {
  id: string | null;
  name: string;
  code: string;
  durationMin: string;
  tone: Tone | null;
}

const blank = (): Editing => ({ id: null, name: "", code: "", durationMin: "5", tone: null });

export function PresetsView() {
  const isDesktop = useIsDesktop();
  const announce = useAnnounce();
  const presets = useLive(["presets"], listPresets);
  const [chosen, setChosen] = useState<Editing | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<Preset | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = presets.data ?? [];
  // En escritorio el panel siempre está visible: por defecto edita el primero propio o crea uno.
  const ownFirst = list.find((p) => !p.example);
  const editing: Editing | null = chosen ?? (isDesktop && presets.data ? (ownFirst ? toEditing(ownFirst) : blank()) : null);
  const setEditing = setChosen;

  function openEdit(p: Preset | null) {
    setEditing(p ? toEditing(p) : blank());
    if (!isDesktop) setSheetOpen(true);
  }

  async function apply(p: Preset) {
    setError(null);
    try {
      await draftFromPreset(p);
      setToast({ text: `«${p.name}» cargado en el Tablero`, href: "/", linkText: "Ir al Tablero" });
    } catch {
      setError("No se pudo cargar el preset en el Tablero. Inténtalo de nuevo.");
    }
  }

  async function onSaved(p: Preset) {
    setSheetOpen(false);
    setEditing(isDesktop ? toEditing(p) : null);
    setToast({ text: `Preset «${p.name}» guardado` });
  }

  async function doDelete(p: Preset) {
    try {
      await deletePreset(p.id);
      setConfirm(null);
      setSheetOpen(false);
      setEditing(isDesktop ? blank() : null);
      setToast({ text: "Preset eliminado" });
      announce(`Preset «${p.name}» eliminado.`);
    } catch {
      setConfirm(null);
      setError("No se pudo eliminar el preset. Inténtalo de nuevo.");
    }
  }

  const editor = editing ? (
    <PresetEditor
      key={editing.id ?? "nuevo"}
      initial={editing}
      onSaved={onSaved}
      onCancel={() => {
        setSheetOpen(false);
        if (!isDesktop) setEditing(null);
      }}
      onAskDelete={(id) => setConfirm(list.find((p) => p.id === id) ?? null)}
      showTitle={isDesktop}
    />
  ) : null;

  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 pb-[120px] lg:px-9 lg:pb-10 lg:pt-6">
      <header className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 lg:pb-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em] lg:text-[32px] lg:tracking-[-0.03em]">Presets</h1>
          <p className="m-0 text-sm leading-normal text-ink-3 lg:text-[15px]">Guardan código, duración y tono. Aplicar uno lo carga en el Tablero sin iniciar la sesión.</p>
        </div>
        <button type="button" className="btn-glass !min-h-11 !px-4" onClick={() => openEdit(null)}>
          <IconPlus size={18} />
          Nuevo preset
        </button>
      </header>

      {error ? <p role="alert" className="mb-3 text-sm text-danger">{error}</p> : null}
      {presets.error ? <p role="alert" className="text-sm text-danger">No se pudieron leer los presets del almacenamiento local.</p> : null}

      <div className="flex flex-wrap items-start gap-[22px]">
        <section aria-label="Tus presets" className="grid min-w-0 flex-[3_1_520px] gap-3.5 2xl:grid-cols-2">
          {list.length === 0 && !presets.loading ? (
            <p className="text-ink-3">Todavía no hay presets. Crea uno o guárdalo desde el Tablero.</p>
          ) : null}
          {list.map((p) => {
            const on = isDesktop && editing?.id === p.id;
            return (
              <article
                key={p.id}
                className={clsx(
                  "flex flex-col gap-3.5 rounded-[22px] border p-4 transition-colors",
                  on ? "border-turq/45 bg-gradient-to-b from-turq-deep/[0.13] to-turq-deep/[0.03]" : "glass",
                )}
              >
                <div className="flex items-center gap-3.5">
                  <Figure code={p.code} id={p.id} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="m-0 break-words text-[17px] font-semibold tracking-[-0.015em]">{p.name}</h2>
                    <span className="text-base font-medium tracking-[0.16em]">{p.code}</span>
                    <span className="text-[13px] text-ink-3">
                      {p.durationMin} min · {p.tone ? `${p.tone} Hz` : "Sin sonido"}
                    </span>
                  </div>
                  <button type="button" className="round sm" aria-label={`Editar ${p.name}`} onClick={() => openEdit(p)}>
                    <IconPencil size={18} />
                  </button>
                </div>
                <div className="flex min-h-11 items-center justify-between gap-2">
                  {p.example ? (
                    <span className="rounded-xl border border-copper-light/25 bg-copper/[0.14] px-2.5 py-1 text-[12.5px] font-medium text-copper-light">Ejemplo · código ilustrativo</span>
                  ) : (
                    <span className="text-[13px] text-ink-3">Editado {relative(p.updatedAt)}</span>
                  )}
                  <button type="button" className="btn-soft" aria-label={`Aplicar ${p.name}`} onClick={() => void apply(p)}>
                    Aplicar
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {isDesktop && editor ? (
          <section aria-label="Editor de preset" className="glass flex min-w-0 flex-[2_1_340px] flex-col gap-4 rounded-[26px] p-6">
            {editor}
          </section>
        ) : null}
      </div>

      {!isDesktop ? (
        <Modal open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} title={editing?.id ? "Editar preset" : "Nuevo preset"}>
          {editor}
        </Modal>
      ) : null}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        role="alertdialog"
        title={confirm ? `¿Eliminar «${confirm.name}»?` : "¿Eliminar el preset?"}
        description="Las sesiones que lo usaron conservan su código y su duración en el historial. No se puede deshacer."
      >
        <div className="flex gap-3">
          <button type="button" className="btn-glass flex-1" onClick={() => setConfirm(null)}>Cancelar</button>
          <button type="button" className="btn-del flex-1" onClick={() => confirm && void doDelete(confirm)}>Eliminar</button>
        </div>
      </Modal>

      <Toast toast={toast} onDone={() => setToast(null)} className="inset-x-4 bottom-[92px] lg:inset-x-auto lg:bottom-7 lg:right-9" />
    </div>
  );
}

function toEditing(p: Preset): Editing {
  return { id: p.id, name: p.name, code: p.code, durationMin: String(p.durationMin), tone: p.tone };
}

function PresetEditor({
  initial,
  onSaved,
  onCancel,
  onAskDelete,
  showTitle,
}: {
  initial: Editing;
  onSaved: (p: Preset) => void;
  onCancel: () => void;
  onAskDelete: (id: string) => void;
  showTitle: boolean;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<PresetValidation>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ids = { name: useId(), code: useId(), min: useId(), tone: useId() };

  async function save() {
    const parsed = parseCodeInput(v.code);
    const input = { name: v.name, code: parsed.ok ? parsed.code : v.code, durationMin: Number(v.durationMin), tone: v.tone };
    const errs = validatePreset(input);
    if (!parsed.ok) errs.code = parsed.error;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFailure(null);
    try {
      onSaved(await savePreset(input, v.id ?? undefined));
    } catch {
      setFailure("No se pudo guardar el preset. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      {showTitle ? <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{v.id ? "Editar preset" : "Nuevo preset"}</h2> : null}
      <Field id={ids.name} label="Nombre" error={errors.name}>
        <input id={ids.name} className="field" value={v.name} maxLength={60} placeholder="Por ejemplo «Mañana tranquila»" aria-invalid={!!errors.name} aria-describedby={errors.name ? `${ids.name}-e` : undefined} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <div className="flex gap-3">
        <div className="flex-[1.6]">
          <Field id={ids.code} label="Código" error={errors.code}>
            <input id={ids.code} className="field text-xl font-medium tracking-[0.16em]" inputMode="numeric" autoComplete="off" value={v.code} maxLength={12} placeholder="00000000" aria-invalid={!!errors.code} aria-describedby={errors.code ? `${ids.code}-e` : undefined} onChange={(e) => setV({ ...v, code: e.target.value })} />
          </Field>
        </div>
        <div className="flex-1">
          <Field id={ids.min} label="Minutos" error={errors.durationMin}>
            <input id={ids.min} className="field text-xl font-medium" type="number" min={1} max={60} inputMode="numeric" value={v.durationMin} aria-invalid={!!errors.durationMin} aria-describedby={errors.durationMin ? `${ids.min}-e` : undefined} onChange={(e) => setV({ ...v, durationMin: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span id={ids.tone} className="text-sm font-medium">Tono preferido</span>
        <div className="seg grid-cols-4" role="group" aria-labelledby={ids.tone}>
          {[null, ...TONES].map((t) => (
            <button key={String(t)} type="button" aria-pressed={v.tone === t} onClick={() => setV({ ...v, tone: t })}>
              {t === null ? "Ninguno" : `${t} Hz`}
            </button>
          ))}
        </div>
      </div>
      <p className="m-0 text-[13px] leading-snug text-ink-3">
        La intención y el testigo no se guardan en el preset: son de cada sesión. Las sesiones pasadas conservan sus valores aunque edites o elimines el preset.
      </p>
      {failure ? <p role="alert" className="m-0 text-sm text-danger">{failure}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-glass" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-go flex-1" disabled={busy}>Guardar preset</button>
      </div>
      {v.id ? (
        <button type="button" className="btn-link self-center !text-danger" onClick={() => v.id && onAskDelete(v.id)}>
          <IconTrash size={18} />
          Eliminar preset
        </button>
      ) : null}
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p id={`${id}-e`} role="alert" className="m-0 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}

function Figure({ code, id }: { code: string; id: string }) {
  const fid = `f-${id.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
      <defs>
        <filter id={fid} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <circle cx="28" cy="28" r="27" fill="#0E0F11" stroke="rgba(217,162,115,0.45)" strokeWidth="1" />
      <polygon points={codeFigurePoints(code, 28, 28, 4, 2.3)} fill="#3CCFC0" fillOpacity="0.45" filter={`url(#${fid})`} />
      <polygon points={codeFigurePoints(code, 28, 28, 4, 2.3)} fill="#3CCFC0" fillOpacity="0.16" stroke="#8CF0E5" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}

function relative(ts: number): string {
  const diff = Date.now() - ts;
  const day = 86_400_000;
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `hace ${Math.round(diff / 60_000)} min`;
  if (diff < day) return `hace ${Math.round(diff / 3_600_000)} h`;
  const d = Math.round(diff / day);
  return d === 1 ? "ayer" : `hace ${d} días`;
}
