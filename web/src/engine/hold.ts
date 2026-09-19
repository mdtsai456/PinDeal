export const HOLD_IDLE_MS = 15_000

export function holdExpired(
  joinCount: number,
  lastJoinAt: string | null,
  nowMs: number,
): boolean {
  if (joinCount <= 0) return false
  if (joinCount >= 4) return true
  if (lastJoinAt == null) return false
  return nowMs - Date.parse(lastJoinAt) >= HOLD_IDLE_MS
}

export function holdRemainingMs(
  joinCount: number,
  lastJoinAt: string | null,
  nowMs: number,
): number {
  if (joinCount <= 0 || joinCount >= 4 || lastJoinAt == null) return 0
  return Math.max(0, HOLD_IDLE_MS - (nowMs - Date.parse(lastJoinAt)))
}

export function holdWaitCopy(joinCount: number, remainingSec: number): string {
  if (joinCount <= 1) return `Solo taxi in ${remainingSec}s if no one joins.`
  return `Match starts in ${remainingSec}s if no one else joins.`
}

export function holdWaitLine(
  joinCount: number,
  lastJoinAt: string | null,
  nowMs: number,
): string {
  return holdWaitCopy(joinCount, Math.ceil(holdRemainingMs(joinCount, lastJoinAt, nowMs) / 1000))
}
