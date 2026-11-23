"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { TONES, type Settings } from "@/domain/types";
import { getSettings, saveSettings } from "@/storage/kv";
import { useLive } from "@/hooks/useLive";
import { useReducedMotion } from "@/hooks/misc";
import { canPromptInstall, detectPlatform, isStandalone, offlineReady, promptInstall, subscribePwa, type Platform } from "@/pwa/pwa";
import { HELP_TEXT } from "@/components/HelpText";
import { formatBytes } from "@/media/image";
import { IconAlert, IconCheck, IconDownload, IconRotate, IconShare, IconVolume } from "@/components/Icons";

export function AjustesView() {
  const settings = useLive(["settings"], getSettings);
  const reduced = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const s = settings.data;

  async function update(patch: Partial<Omit<Settings, "key">>) {
    setError(null);
    try {
      await saveSettings(patch);
    } catch {
      setError("No se pudieron guardar los ajustes. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1160px] px-4 pb-[120px] lg:px-9 lg:pb-10 lg:pt-6">
      <header className="flex min-h-[60px] items-center lg:pb-5">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em] lg:text-[32px] lg:tracking-[-0.03em]">Ajustes</h1>
      </header>
      {error ? <p role="alert" className="mb-3 text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-start gap-[22px]">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
          <Section title="Sonido">
            <div className="glass overflow-hidden rounded-[22px]">
              <SwitchRow
                icon={<IconVolume size={18} />}
                label="Sonido al iniciar"
                hint="Parte apagado; también se activa en la sesión."
                checked={s?.soundOnStart ?? false}
                onChange={(v) => void update({ soundOnStart: v })}
              />
              <div className="ml-[68px] h-px bg-white/[0.06]" />
              <ToneRow value={s?.tone ?? 432} onChange={(t) => void update({ tone: t })} />
              <div className="ml-[18px] h-px bg-white/[0.06]" />
              <VolumeRow value={s?.volume ?? 0.2} onChange={(v) => void update({ volume: v })} />
            </div>
            <p className="mx-1 my-0 text-[13px] leading-normal text-ink-3">
              Se detiene al pausar, al finalizar, al salir de la sesión o si la pestaña queda oculta. En iPhone, el modo silencio puede apagarlo.
            </p>
          </Section>

          <Section title="Movimiento">
            <div className="glass overflow-hidden rounded-[22px]">
              <SwitchRow
                icon={<IconRotate size={18} />}
                label="Animación de la sesión"
                hint="La figura gira despacio mientras corre el tiempo."
                checked={s?.animations ?? true}
                onChange={(v) => void update({ animations: v })}
              />
            </div>
            {reduced ? (
              <p className="m-0 rounded-2xl border border-turq/25 bg-turq-deep/10 px-3.5 py-3 text-sm leading-snug text-[#CFF3EE]">
                Tu dispositivo pide reducir el movimiento: la figura se mostrará fija.
              </p>
            ) : null}
          </Section>

          <Section title="Ayuda">
            <p className="m-0 rounded-[22px] border border-copper-light/35 bg-gradient-to-b from-copper/[0.12] to-copper/[0.04] px-[18px] py-4 text-[15px] leading-relaxed">
              {HELP_TEXT}
            </p>
          </Section>
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[22px]">
          <InstallSection />
          <DataSection />
          <section aria-label="Acerca de Octava" className="flex flex-col items-center gap-2 px-1 py-1.5 lg:flex-row lg:gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/octava-logo.png" alt="Octava" width={122} height={32} />
            <span className="text-[13px] text-ink-3">Versión 1.0 · funciona sin conexión</span>
          </section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="m-0 ml-1 text-[13px] font-medium text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

function SwitchRow({ icon, label, hint, checked, onChange }: { icon: React.ReactNode; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-16 items-center gap-3.5 px-[18px] py-3">
      <span className="ico">{icon}</span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span id={id} className="text-[15px] font-medium">{label}</span>
        <span className="text-[13px] text-ink-3">{hint}</span>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className="switch" onClick={() => onChange(!checked)}>
        <span className="tr"><span className="kn" /></span>
      </button>
    </div>
  );
}

function ToneRow({ value, onChange }: { value: number; onChange: (t: (typeof TONES)[number]) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5 px-[18px] py-3.5">
      <span id={id} className="text-[15px] font-medium">Tono</span>
      <div className="seg grid-cols-3" role="group" aria-labelledby={id}>
        {TONES.map((t) => (
          <button key={t} type="button" aria-pressed={value === t} onClick={() => onChange(t)}>
            {t} Hz
          </button>
        ))}
      </div>
      <span className="text-[13px] text-ink-3">Tono audible reproducido por tu dispositivo.</span>
    </div>
  );
}

function VolumeRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const [local, setLocal] = useState(Math.round(value * 100));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    // Otro lugar cambió el volumen: se ajusta durante el render, sin efecto.
    setPrev(value);
    setLocal(Math.round(value * 100));
  }
  return (
    <div className="px-[18px] pb-2 pt-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[15px] font-medium">Volumen</label>
        <span className="text-sm text-ink-3">{local} %</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={local}
        className="h-11 w-full accent-turq-deep"
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => onChange(local / 100)}
        onKeyUp={() => onChange(local / 100)}
        onBlur={() => onChange(local / 100)}
      />
    </div>
  );
}

function usePwaState() {
  return useSyncExternalStore(
    subscribePwa,
    () => `${canPromptInstall()}|${isStandalone()}|${offlineReady()}`,
    () => "false|false|false",
  );
}

function InstallSection() {
  usePwaState();
  const platform = useSyncExternalStore<Platform>(
    () => () => undefined,
    detectPlatform,
    () => "other",
  );
  const standalone = isStandalone();
  const canPrompt = canPromptInstall();

  return (
    <Section title="Instalar la app">
      <div className="glass flex flex-col gap-3.5 rounded-[22px] p-[18px]">
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={56} height={56} className="rounded-[13px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]" />
          <p className="m-0 text-[15px] leading-normal text-ink-2">Ábrela en su propia ventana, con su icono y sin conexión.</p>
        </div>
        {standalone ? (
          <p className="m-0 flex items-center gap-2.5 text-[15px]">
            <IconCheck size={20} className="text-turq" /> Ya la estás usando como app.
          </p>
        ) : canPrompt ? (
          <button type="button" className="btn-go self-start" onClick={() => void promptInstall()}>
            <IconDownload size={18} />
            Instalar Octava
          </button>
        ) : platform === "ios" ? (
          <Steps
            intro="En iPhone y iPad se instala desde Safari, en tres pasos:"
            steps={[
              <>Toca <strong className="font-semibold">Compartir</strong> <IconShare size={18} className="inline align-[-3px]" /> en Safari.</>,
              <>Elige <strong className="font-semibold">Añadir a pantalla de inicio</strong>.</>,
              <>Ábrela desde su icono.</>,
            ]}
            foot="Instalada, Safari conserva mejor tus datos locales."
          />
        ) : platform === "mac-safari" ? (
          <Steps
            steps={[
              <>En Safari, abre el menú <strong className="font-semibold">Archivo</strong>.</>,
              <>Elige <strong className="font-semibold">Añadir al Dock</strong>.</>,
              <>Ábrela desde el Dock o desde Aplicaciones.</>,
            ]}
          />
        ) : platform === "android" ? (
          <p className="m-0 text-[15px] leading-normal text-ink-2">
            Abre el menú del navegador y elige <strong className="font-semibold">Instalar app</strong> o <strong className="font-semibold">Añadir a pantalla de inicio</strong>.
          </p>
        ) : (
          <p className="m-0 text-[15px] leading-normal text-ink-2">
            Si tu navegador lo permite, verás el botón de instalar en la barra de direcciones. Si no, puedes seguir usándola en una pestaña: funciona igual, también sin conexión.
          </p>
        )}
      </div>
    </Section>
  );
}

function Steps({ intro, steps, foot }: { intro?: string; steps: React.ReactNode[]; foot?: string }) {
  return (
    <>
      {intro ? <p className="m-0 text-[15px] text-ink-2">{intro}</p> : null}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-[15px]">
            <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-copper-light/40 bg-copper/[0.14] text-sm font-semibold text-copper-light" aria-hidden="true">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {foot ? <p className="m-0 text-[13px] text-ink-3">{foot}</p> : null}
    </>
  );
}

function DataSection() {
  const pwa = usePwaState();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const st = navigator.storage;
    if (st?.persisted) void st.persisted().then((p) => alive && setPersisted(p)).catch(() => undefined);
    if (st?.estimate) void st.estimate().then((e) => alive && setUsage(e.usage ?? null)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  async function askPersist() {
    try {
      const ok = await navigator.storage?.persist?.();
      setPersisted(!!ok);
    } catch {
      setPersisted(false);
    }
  }

  const ready = pwa.split("|")[2] === "true";
  return (
    <Section title="Tus datos">
      <div className="glass flex flex-col gap-3 rounded-[22px] p-[18px]">
        <p className="m-0 text-[15px] leading-normal text-ink-2">
          Presets, sesiones, notas e imágenes se guardan solo en este navegador. Sin cuenta y sin copia en internet.
        </p>
        <p className="m-0 flex gap-2 text-sm leading-snug text-amber">
          <IconAlert size={18} className="shrink-0" />
          Si borras los datos del sitio en el navegador, se pierden.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Almacenamiento persistente" value={persisted === null ? "—" : persisted ? "Concedido" : "No concedido"} on={!!persisted} />
          <Stat label="Espacio usado" value={usage === null ? "—" : formatBytes(usage)} />
          <Stat label="Sin conexión" value={ready ? "Disponible" : "Tras la primera carga"} on={ready} />
        </div>
        {persisted === false ? (
          <button type="button" className="btn-soft self-start" onClick={() => void askPersist()}>
            Pedir almacenamiento persistente
          </button>
        ) : null}
      </div>
    </Section>
  );
}

function Stat({ label, value, on }: { label: string; value: string; on?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.04] px-3.5 py-3">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span className={on ? "text-base font-semibold text-turq" : "text-base font-semibold"}>{value}</span>
    </div>
  );
}

