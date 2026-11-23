import { describe, expect, it } from "vitest";
import { formatClock, isExpired, remainingMs, toPaused, toRecord, toRunning } from "@/domain/timer";
import { emptyConfig, type RunningSession } from "@/domain/types";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

function running(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    key: "current", id: "s1", config: emptyConfig(), startedAt: T0, durationMs: 5 * MIN, rev: 1, soundOn: false,
    updatedAt: T0, status: "running", endsAt: T0 + 5 * MIN, segmentMs: 5 * MIN, ...overrides,
  };
}

describe("temporizador basado en estado persistido", () => {
  it("calcula el restante en los bordes del vencimiento", () => {
    const s = running();
    expect(remainingMs(s, s.endsAt - 1)).toBe(1);
    expect(remainingMs(s, s.endsAt)).toBe(0);
    expect(remainingMs(s, s.endsAt + 1)).toBe(0);
    expect(isExpired(s, s.endsAt - 1)).toBe(false);
    expect(isExpired(s, s.endsAt)).toBe(true);
  });

  it("un reloj atrasado no alarga el tramo más allá de su saldo", () => {
    const s = running();
    expect(remainingMs(s, T0 - 10 * MIN)).toBe(5 * MIN);
  });

  it("pausar guarda el restante y reanudar crea una marca de fin nueva", () => {
    const s = running();
    const p = toPaused(s, T0 + 2 * MIN);
    expect(p.status).toBe("paused");
    expect(p.remainingMs).toBe(3 * MIN);
    expect(p.rev).toBe(2);
    // Una recarga o pasar horas en pausa no cambia el restante.
    expect(remainingMs(p, T0 + 9 * 60 * MIN)).toBe(3 * MIN);
    const r = toRunning(p, T0 + 60 * MIN);
    expect(r.endsAt).toBe(T0 + 63 * MIN);
    expect(r.segmentMs).toBe(3 * MIN);
    expect(remainingMs(r, T0 + 61 * MIN)).toBe(2 * MIN);
  });

  it("el cierre automático usa la marca de fin aunque se reabra horas después", () => {
    const s = running();
    const rec = toRecord(s, T0 + 300 * MIN, "complete");
    expect(rec.status).toBe("completed");
    expect(rec.endedAt).toBe(s.endsAt);
    expect(rec.elapsedMs).toBe(5 * MIN);
  });

  it("finalizar antes descuenta las pausas", () => {
    const p = toPaused(running(), T0 + 2 * MIN); // quedan 3 min
    const r = toRunning(p, T0 + 30 * MIN); // pausa de 28 min
    const rec = toRecord(r, T0 + 31 * MIN, "end-early");
    expect(rec.status).toBe("ended-early");
    expect(rec.elapsedMs).toBe(3 * MIN);
  });

  it("el vencimiento gana: finalizar antes con saldo cero completa la sesión", () => {
    const s = running();
    const rec = toRecord(s, s.endsAt, "end-early");
    expect(rec.status).toBe("completed");
  });

  it("no completa una sesión que todavía no venció", () => {
    expect(() => toRecord(running(), T0 + MIN, "complete")).toThrow();
  });

  it("formatea mm:ss redondeando hacia arriba", () => {
    expect(formatClock(5 * MIN)).toBe("05:00");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(192_000)).toBe("03:12");
  });
});
