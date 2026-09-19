import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loginWithUsername, readSessionUsername } from './auth'

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
  }
}

describe('loginWithUsername', () => {
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

  it('成功時寫入正規 username', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 2, username: 'Lin', riderId: 'B' }),
      }),
    )
    const result = await loginWithUsername('lin')
    expect(result).toEqual({ ok: true, username: 'Lin' })
    expect(readSessionUsername()).toBe('Lin')
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('未知使用者不寫 session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'unknown_user' }),
      }),
    )
    const result = await loginWithUsername('Chen')
    expect(result).toEqual({ ok: false })
    expect(readSessionUsername()).toBe(null)
  })
})
