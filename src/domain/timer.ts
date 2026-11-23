import type { ActiveSession, PausedSession, RunningSession, SessionRecord } from "./types";

/**
 * Tiempo restante calculado siempre desde el estado persistido, nunca contando ticks.
 * En curso, se acota al saldo del tramo para que un reloj atrasado no alargue la sesión
 * más allá de lo que quedaba al reanudar.
 */
export function remainingMs(session: ActiveSession, now: number): number {
  if (session.status === "paused") {
    return clamp(session.remainingMs, 0, session.durationMs);
  }
  return clamp(session.endsAt - now, 0, Math.min(session.segmentMs, session.durationMs));
}

export function isExpired(session: ActiveSession, now: number): boolean {
  return session.status === "running" && remainingMs(session, now) === 0;
}

export function toPaused(session: RunningSession, now: number): PausedSession {
  return {
    key: "current",
    id: session.id,
    config: session.config,
    startedAt: session.startedAt,
    durationMs: session.durationMs,
    soundOn: session.soundOn,
    rev: session.rev + 1,
    updatedAt: now,
    status: "paused",
    remainingMs: remainingMs(session, now),
  };
}

export function toRunning(session: PausedSession, now: number): RunningSession {
  const rest = clamp(session.remainingMs, 0, session.durationMs);
  return {
    key: "current",
    id: session.id,
    config: session.config,
    startedAt: session.startedAt,
    durationMs: session.durationMs,
    soundOn: session.soundOn,
    rev: session.rev + 1,
    updatedAt: now,
    status: "running",
    endsAt: now + rest,
    segmentMs: rest,
  };
}

/**
 * Registro de historial para una sesión. «El vencimiento gana»: si el saldo es cero,
 * la sesión queda completada aunque la acción fuera pausar o finalizar antes.
 */
export function toRecord(session: ActiveSession, now: number, requested: "complete" | "end-early"): SessionRecord {
  const rest = remainingMs(session, now);
  if (requested === "complete" && rest > 0) {
    throw new Error("La sesión todavía no ha vencido.");
  }
  if (rest === 0) {
    // Si venció en curso, el final real es la marca de fin, no la hora de reapertura.
    const endedAt = session.status === "running" ? Math.min(now, session.endsAt) : now;
    return baseRecord(session, Math.max(session.startedAt, endedAt), session.durationMs, "completed");
  }
  return baseRecord(session, now, session.durationMs - rest, "ended-early");
}

function baseRecord(session: ActiveSession, endedAt: number, elapsed: number, status: SessionRecord["status"]): SessionRecord {
  return {
    id: session.id,
    config: session.config,
    startedAt: session.startedAt,
    endedAt,
    durationMs: session.durationMs,
    elapsedMs: clamp(elapsed, 0, session.durationMs),
    status,
    note: "",
    noteUpdatedAt: null,
  };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
