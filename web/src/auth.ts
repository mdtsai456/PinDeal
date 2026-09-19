import { USERNAMES, USERNAME_TO_RIDER, normalizeUsername, type Username } from './engine/match'
import type { RiderId } from './types'

export const SESSION_USERNAME_KEY = 'pindeal.username'

export function isUsername(value: string): value is Username {
  return USERNAMES.some((name) => name === value)
}

function sessionStore(): Storage | null {
  try {
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export function readSessionUsername(): Username | null {
  const raw = sessionStore()?.getItem(SESSION_USERNAME_KEY)
  if (!raw) return null
  const username = normalizeUsername(raw)
  return isUsername(username) ? username : null
}

export function writeSessionUsername(name: Username): void {
  sessionStore()?.setItem(SESSION_USERNAME_KEY, name)
}

export function clearSessionUsername(): void {
  sessionStore()?.removeItem(SESSION_USERNAME_KEY)
}

export function readSessionRiderId(): RiderId | null {
  const username = readSessionUsername()
  return username ? USERNAME_TO_RIDER[username] : null
}

export type LoginResult = { ok: true; username: Username } | { ok: false }

export async function loginWithUsername(raw: string): Promise<LoginResult> {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: raw }),
    })
    if (!response.ok) return { ok: false }
    const body = (await response.json()) as { username?: unknown }
    const username = typeof body.username === 'string' ? normalizeUsername(body.username) : ''
    if (!isUsername(username)) return { ok: false }
    writeSessionUsername(username)
    return { ok: true, username }
  } catch {
    return { ok: false }
  }
}
