"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import clsx from "clsx";
import { CODE_LENGTH, clampDial, codeToDials, dialsToCode, parseCodeInput } from "@/domain/code";
import { IconMinus, IconPencil, IconPlus } from "@/components/Icons";

interface Props {
  dials: number[];
  onChange: (dials: number[]) => void;
  onValidityChange: (valid: boolean) => void;
  large?: boolean;
  /** Acción extra en la cabecera, junto a «Escribir código». */
  headerAction?: ReactNode;
  /** Contenido bajo los diales (el significado del código). */
  below?: ReactNode;
}

/**
 * Edición del código: ocho diales con tabindex móvil, una perilla grande para el dial
 * seleccionado (con un control deslizante nativo encima) y un campo de texto para escribir o pegar.
 */
export function CodeEditor({ dials, onChange, onValidityChange, large = false, headerAction, below }: Props) {
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(dialsToCode(dials));
  const [error, setError] = useState<string | null>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const helpId = useId();
  const inputId = useId();

  // El código puede cambiar desde fuera («Mis códigos», la propuesta o un preset aplicado en otra
  // pestaña): el campo de texto abierto pasa a mostrar el código nuevo.
  const code = dialsToCode(dials);
  const [seenCode, setSeenCode] = useState(code);
  if (code !== seenCode) {
    setSeenCode(code);
    if (editing) {
      const parsed = parseCodeInput(text);
      if (!parsed.ok || parsed.code !== code) {
        setText(code);
        setError(null);
      }
    }
  }

  useEffect(() => {
    onValidityChange(error === null);
  }, [error, onValidityChange]);

  function setDial(i: number, v: number) {
    const next = dials.slice();
    next[i] = clampDial(v);
    onChange(next);
    if (editing) {
      // Un solo valor visible: el campo de texto refleja lo que hace la perilla.
      setText(dialsToCode(next));
      setError(null);
    }
  }

  function moveSel(i: number) {
    const n = (i + CODE_LENGTH) % CODE_LENGTH;
    setSel(n);
    slotRefs.current[n]?.focus();
  }

  function onSlotKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const k = e.key;
    if (k === "ArrowRight") moveSel(i + 1);
    else if (k === "ArrowLeft") moveSel(i - 1);
    else if (k === "Home") moveSel(0);
    else if (k === "End") moveSel(CODE_LENGTH - 1);
    else if (k === "ArrowUp" || k === "PageUp") setDial(i, dials[i] + 1);
    else if (k === "ArrowDown" || k === "PageDown") setDial(i, dials[i] - 1);
    else if (/^[0-9]$/.test(k)) {
      setDial(i, Number(k));
      if (i < CODE_LENGTH - 1) moveSel(i + 1);
    } else return;
    e.preventDefault();
  }

  function onText(raw: string) {
    setText(raw);
    const parsed = parseCodeInput(raw);
    if (parsed.ok) {
      setError(null);
      onChange(codeToDials(parsed.code));
    } else {
      setError(parsed.error);
    }
  }

  function toggleEdit() {
    if (editing) {
      if (error) return; // no se cierra con un código inválido: el error queda visible
      setEditing(false);
      requestAnimationFrame(() => toggleRef.current?.focus());
    } else {
      setText(dialsToCode(dials));
      setEditing(true);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }

  const value = dials[sel] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h2 id={`${inputId}-t`} className="m-0 text-[13px] font-medium text-ink-3">
            Código
          </h2>
          <div className="flex items-center">
            {headerAction}
            <button ref={toggleRef} type="button" data-tour="write-code" className="btn-link" onClick={toggleEdit} aria-expanded={editing}>
              <IconPencil size={16} strokeWidth={2} />
              {editing ? "Listo" : "Escribir código"}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="sr-only">
              Código de 8 dígitos
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="field h-[78px] text-center text-[34px] tracking-[0.22em]"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={14}
              value={text}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={helpId}
              onChange={(e) => onText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  toggleEdit();
                }
              }}
            />
            <p id={helpId} role={error ? "alert" : undefined} className={clsx("m-0 text-center text-[13px]", error ? "text-danger" : "text-ink-3")}>
              {error ?? "Pega o escribe los 8 dígitos; los diales se ajustan solos."}
            </p>
          </div>
        ) : (
          <div role="group" data-tour="slots" aria-labelledby={`${inputId}-t`} className={clsx("flex justify-center", large ? "gap-2" : "gap-1")}>
            {dials.map((v, i) => (
              <button
                key={i}
                ref={(el) => {
                  slotRefs.current[i] = el;
                }}
                type="button"
                className={clsx("slot", large && "!h-[78px] !w-[54px] [&_.dg]:!text-[30px]", i === 4 && (large ? "ml-3.5" : "ml-2.5"))}
                aria-pressed={i === sel}
                aria-label={`Dial ${i + 1}, valor ${v}`}
                tabIndex={i === sel ? 0 : -1}
                onClick={() => setSel(i)}
                onKeyDown={(e) => onSlotKey(e, i)}
              >
                <span className="dg">{v}</span>
                <MiniRing value={v} on={i === sel} />
              </button>
            ))}
          </div>
        )}
        {below && !error ? below : null}
      </div>

      <Knob
        dial={sel}
        value={value}
        large={large}
        onSet={(v) => setDial(sel, v)}
      />
    </div>
  );
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  };
  const s = p(a0);
  const e = p(Math.max(a1, a0 + 0.01));
  return `M${s[0].toFixed(2)} ${s[1].toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)}`;
}

function MiniRing({ value, on }: { value: number; on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d={arc(9, 9, 7, -135, 135)} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeLinecap="round" />
      {value > 0 ? (
        <path d={arc(9, 9, 7, -135, -135 + value * 30)} fill="none" stroke={on ? "#6BE4D7" : "#C08457"} strokeWidth="2" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

function Knob({ dial, value, onSet, large }: { dial: number; value: number; onSet: (v: number) => void; large: boolean }) {
  const size = large ? 320 : 248;
  const c = size / 2;
  const ring = large ? 130 : 100;
  const numR = large ? 148 : 114;
  const bezel = large ? 228 : 176;
  const drag = useRef(false);

  function fromPointer(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 20) return;
    let ang = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (ang > 150 || ang < -150) return;
    ang = Math.max(-135, Math.min(135, ang));
    const v = Math.round((ang + 135) / 30);
    if (v !== value) onSet(v);
  }

  return (
    <section aria-label="Dial seleccionado" data-tour="knob" className="flex flex-col items-center gap-1.5">
      <span className="text-[13px] text-ink-3">
        <span className="font-semibold text-turq">Dial {dial + 1}</span> · arrastra la perilla o usa las flechas
      </span>
      <div
        className="relative touch-none select-none"
        style={{ width: size, height: size }}
        onPointerDown={(e) => {
          drag.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (drag.current) fromPointer(e);
        }}
        onPointerUp={() => {
          drag.current = false;
        }}
        onPointerCancel={() => {
          drag.current = false;
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0">
          <defs>
            <linearGradient id="knob-tq" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#2FB9AB" />
              <stop offset="1" stopColor="#8CF0E5" />
            </linearGradient>
          </defs>
          <path d={arc(c, c, ring, -135, 135)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="5" strokeLinecap="round" />
          {value > 0 ? (
            <path
              d={arc(c, c, ring, -135, -135 + value * 30)}
              fill="none"
              stroke="url(#knob-tq)"
              strokeWidth="5"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 6px rgba(60,207,192,0.7))" }}
            />
          ) : null}
          {Array.from({ length: 10 }, (_, k) => {
            const t = ((-135 + k * 30 - 90) * Math.PI) / 180;
            return (
              <text
                key={k}
                x={(c + numR * Math.cos(t)).toFixed(1)}
                y={(c + numR * Math.sin(t)).toFixed(1)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={large ? 13 : 12}
                fontWeight={k === value ? 700 : 500}
                fill={k === value ? "#6BE4D7" : k < value ? "#D9A273" : "#8C8880"}
                style={{ fontFamily: "inherit" }}
              >
                {k}
              </text>
            );
          })}
        </svg>
        <div
          className="absolute rounded-full"
          style={{
            left: (size - bezel) / 2,
            top: (size - bezel) / 2,
            width: bezel,
            height: bezel,
            background: "conic-gradient(from 200deg, #6E4428, #D9A273, #8A5634, #ECBF92, #7A4C2E, #C99063, #6E4428)",
            boxShadow: "0 26px 44px -14px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -3px 8px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="absolute inset-[14px] rounded-full transition-transform duration-300 ease-out"
            style={{
              transform: `rotate(${-135 + value * 30}deg)`,
              background:
                "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.025) 0 1px, rgba(255,255,255,0) 1px 4px), radial-gradient(circle at 50% 30%, #363B42 0%, #1C1F23 58%, #121417 100%)",
              boxShadow: "inset 0 2px 3px rgba(255,255,255,0.08), inset 0 -10px 18px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.6)",
            }}
          >
            <span
              className="absolute left-1/2 top-2.5 -ml-[2.5px] h-[18px] w-[5px] rounded-[3px] bg-turq"
              style={{ boxShadow: "0 0 10px rgba(60,207,192,0.9), 0 0 2px rgba(255,255,255,0.8)" }}
            />
          </div>
        </div>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center font-light tracking-[-0.04em]" style={{ fontSize: large ? 72 : 56 }}>
          {value}
        </span>
        <input
          type="range"
          min={0}
          max={9}
          step={1}
          value={value}
          onChange={(e) => onSet(Number(e.target.value))}
          aria-label={`Dial ${dial + 1}`}
          aria-valuetext={`Dial ${dial + 1}, valor ${value}`}
          className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
          style={{ pointerEvents: "none" }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full opacity-0 ring-2 ring-turq ring-offset-4 ring-offset-carbon peer-focus-visible:opacity-100"
          style={{ left: (size - bezel) / 2, top: (size - bezel) / 2, width: bezel, height: bezel }}
        />
      </div>
      <div className="flex items-center gap-7">
        <button type="button" className="round" aria-label="Bajar el dial seleccionado" onClick={() => onSet(value - 1)} disabled={value <= 0}>
          <IconMinus size={22} />
        </button>
        <span className="min-w-16 text-center text-[13px] text-ink-3">0 – 9</span>
        <button type="button" className="round" aria-label="Subir el dial seleccionado" onClick={() => onSet(value + 1)} disabled={value >= 9}>
          <IconPlus size={22} />
        </button>
      </div>
    </section>
  );
}
