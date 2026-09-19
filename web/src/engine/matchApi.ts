import type { MatchRecord } from './match'
import type { MatchJoinBody } from './routePage'

export type JoinErrorCode = 'walk_circles_miss' | 'match_full'

export type JoinMatchResult =
  | { ok: true; record: MatchRecord }
  | { ok: false; message: string }

export const MATCH_POLL_MS = 800

export function joinErrorCopy(code: JoinErrorCode): string {
  switch (code) {
    case 'walk_circles_miss':
      return 'Your walk range does not meet this group.'
    case 'match_full':
      return 'This group is full.'
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}

export function joinErrorMessage(error: unknown): string {
  if (error === 'walk_circles_miss' || error === 'match_full') {
    return joinErrorCopy(error)
  }
  return 'Could not join this group.'
}

export async function postMatchJoin(body: MatchJoinBody): Promise<JoinMatchResult> {
  try {
    const response = await fetch('/api/match/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) {
      const record = (await response.json()) as MatchRecord
      return { ok: true, record }
    }
    let error: unknown = ''
    try {
      const payload = (await response.json()) as { error?: unknown }
      error = payload.error
    } catch {
      error = ''
    }
    return { ok: false, message: joinErrorMessage(error) }
  } catch {
    return { ok: false, message: joinErrorMessage('') }
  }
}

export async function fetchMatch(): Promise<MatchRecord> {
  const response = await fetch('/api/match')
  if (!response.ok) {
    throw new Error('match_unavailable')
  }
  return (await response.json()) as MatchRecord
}
