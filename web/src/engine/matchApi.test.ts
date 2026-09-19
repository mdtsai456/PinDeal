import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneRider } from '../data'
import { fetchMatch, joinErrorCopy, joinErrorMessage, MATCH_POLL_MS, postMatchJoin } from './matchApi'
import { snapshotRoutePage } from './routePage'

function joinBody() {
  const demand = cloneRider('A')
  return {
    username: 'Yu' as const,
    demand,
    routePage: snapshotRoutePage({
      pickup: {
        id: demand.originId,
        name: 'Pickup',
        address: '',
        lat: 24.8018,
        lng: 120.9717,
      },
      dropoff: {
        id: demand.destinationId,
        name: 'Dropoff',
        address: '',
        lat: 24.7956,
        lng: 120.9925,
      },
      soloDurationMin: 11,
      soloDistanceKm: 2.3,
      extraTimeMin: demand.maxDetourMin,
      maxWalkMin: demand.maxWalkMin,
      bags: demand.luggageCount,
      accessible: demand.accessibility,
      extraPay: demand.extraPay,
      notes: demand.rawText,
    }),
  }
}

describe('joinErrorCopy', () => {
  it('圈不合用指定英文', () => {
    expect(joinErrorCopy('walk_circles_miss')).toBe('Your walk range does not meet this group.')
  })

  it('滿員用英文', () => {
    expect(joinErrorCopy('match_full')).toBe('This group is full.')
  })

  it('未知錯誤不洩漏代碼', () => {
    expect(joinErrorMessage('nope')).toBe('Could not join this group.')
  })
})

describe('postMatchJoin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('成功回傳團檔', async () => {
    const record = {
      id: 'current',
      status: 'collecting',
      adopted: 'solo',
      riders: [],
      lastJoinAt: null,
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => record,
    })
    vi.stubGlobal('fetch', fetchMock)
    const body = joinBody()
    const result = await postMatchJoin(body)
    expect(result).toEqual({ ok: true, record })
    expect(fetchMock).toHaveBeenCalledWith('/api/match/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  })

  it('409 walk_circles_miss 回英文', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'walk_circles_miss' }),
      }),
    )
    const result = await postMatchJoin(joinBody())
    expect(result).toEqual({
      ok: false,
      message: 'Your walk range does not meet this group.',
    })
  })

  it('409 match_full 回英文', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'match_full' }),
      }),
    )
    const result = await postMatchJoin(joinBody())
    expect(result).toEqual({
      ok: false,
      message: 'This group is full.',
    })
  })
})

describe('fetchMatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('GET /api/match', async () => {
    const record = {
      id: 'current',
      status: 'collecting',
      adopted: 'solo',
      riders: [],
      lastJoinAt: null,
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => record,
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchMatch()).resolves.toEqual(record)
    expect(fetchMock).toHaveBeenCalledWith('/api/match')
  })
})

describe('MATCH_POLL_MS', () => {
  it('每 800ms 輪詢', () => {
    expect(MATCH_POLL_MS).toBe(800)
  })
})
