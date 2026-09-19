import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_USERNAME_KEY,
  clearSessionUsername,
  readSessionRiderId,
  readSessionUsername,
  writeSessionUsername,
} from './auth'

function mockSession() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => {
      data.clear()
    },
  }
}

describe('session username', () => {
  const localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }

  beforeEach(() => {
    vi.stubGlobal('sessionStorage', mockSession())
    vi.stubGlobal('localStorage', localStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('寫入後讀到正規名稱', () => {
    writeSessionUsername('Yu')
    expect(readSessionUsername()).toBe('Yu')
    expect(sessionStorage.getItem(SESSION_USERNAME_KEY)).toBe('Yu')
  })

  it('小寫庫存正規成 seed 名', () => {
    sessionStorage.setItem(SESSION_USERNAME_KEY, 'lin')
    expect(readSessionUsername()).toBe('Lin')
    expect(readSessionRiderId()).toBe('B')
  })

  it('未知字回 null', () => {
    sessionStorage.setItem(SESSION_USERNAME_KEY, 'Chen')
    expect(readSessionUsername()).toBe(null)
    expect(readSessionRiderId()).toBe(null)
  })

  it('清除後讀不到', () => {
    writeSessionUsername('Yang')
    clearSessionUsername()
    expect(readSessionUsername()).toBe(null)
    expect(sessionStorage.getItem(SESSION_USERNAME_KEY)).toBe(null)
  })

  it('不寫 localStorage', () => {
    writeSessionUsername('Chiang')
    clearSessionUsername()
    expect(localStorage.setItem).not.toHaveBeenCalled()
    expect(localStorage.removeItem).not.toHaveBeenCalled()
    expect(localStorage.getItem).not.toHaveBeenCalled()
  })

  it('另一個 sessionStorage 讀不到上一筆', () => {
    writeSessionUsername('Yu')
    vi.stubGlobal('sessionStorage', mockSession())
    expect(readSessionUsername()).toBe(null)
  })

  it('Yu Lin Chiang Yang 對到 A B C D', () => {
    writeSessionUsername('Yu')
    expect(readSessionRiderId()).toBe('A')
    writeSessionUsername('Lin')
    expect(readSessionRiderId()).toBe('B')
    writeSessionUsername('Chiang')
    expect(readSessionRiderId()).toBe('C')
    writeSessionUsername('Yang')
    expect(readSessionRiderId()).toBe('D')
  })
})
