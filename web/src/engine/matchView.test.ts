import { describe, expect, it } from 'vitest'
import type { MatchRecord, MatchRider, Username } from './match'
import { USERNAME_TO_RIDER } from './match'
import {
  canSkipToPay,
  isMatchReady,
  keepOwnMatch,
  ownFare,
  ownTheater,
  payVisibleText,
  payView,
  sharePaxCount,
  THEATER_LINE_MS,
} from './matchView'

function rider(username: Username, patch: Partial<MatchRider> = {}): MatchRider {
  return {
    username,
    riderId: USERNAME_TO_RIDER[username],
    routePage: {
      pickup: { id: 'p', name: 'P', address: '', lat: 24.8, lng: 120.97 },
      dropoff: { id: 'd', name: 'D', address: '', lat: 24.79, lng: 120.99 },
      soloDurationMin: 12,
      soloDistanceKm: 2.4,
      extraTimeMin: 8,
      sharedCapMin: 20,
      maxWalkMin: 8,
      bags: 0,
      accessible: false,
      extraPay: false,
      notes: '',
      originCircle: { lat: 24.8, lng: 120.97, radiusKm: 0.64 },
      destCircle: { lat: 24.79, lng: 120.99, radiusKm: 0.64 },
    },
    demand: {
      id: USERNAME_TO_RIDER[username],
      name: username,
      title: username,
      rawText: '',
      originId: 'p',
      destinationId: 'd',
      latestArrival: '',
      maxWaitMin: 5,
      maxWalkMin: 8,
      maxDetourMin: 8,
      luggageCount: 0,
      accessibility: false,
      extraDemand: '',
      priority: 'price',
      extraPay: false,
      privateFloor: { maxFare: 0, note: '' },
    },
    structured: {
      riderId: USERNAME_TO_RIDER[username],
      origin: 'p',
      destination: 'd',
      latestArrival: null,
      maxWaitMin: 5,
      maxWalkMin: 8,
      maxDetourMin: 8,
      luggage: 0,
      accessibility: false,
      extraPay: false,
      priority: 'price',
      extras: [],
    },
    v1: {
      walkMin: 4,
      rideMin: 16,
      fare: 144,
      soloFare: 200,
      soloRideMin: 12,
      accessible: true,
      luggageOk: true,
    },
    v2: {
      walkMin: 4,
      rideMin: 16,
      fare: 144,
      soloFare: 200,
      soloRideMin: 12,
      accessible: true,
      luggageOk: true,
    },
    scoreV1: 1,
    scoreV2: 1,
    pitch: { axis: 'fare', give: 'walk', note: '' },
    theater: [],
    kicked: false,
    outcome: 'share',
    finalWalkMin: 4,
    finalRideMin: 16,
    finalFare: 144,
    ...patch,
  }
}

const collecting: MatchRecord = {
  id: 'current',
  status: 'collecting',
  adopted: 'solo',
  joins: [],
  riders: [rider('Yu', { theater: [], outcome: 'solo', finalFare: 0 })],
  sharePlan: null,
  lastJoinAt: null,
}

const settled: MatchRecord = {
  id: 'current',
  status: 'settled',
  adopted: 'v1',
  joins: [],
  sharePlan: null,
  lastJoinAt: null,
  riders: [
    rider('Yu', {
      theater: ['I scored this shared plan against your walls only.', 'Your fare is NT$144.'],
      outcome: 'share',
      finalFare: 144,
    }),
    rider('Lin', {
      theater: ['Lin should never appear on Yu screen.', 'Your fare is NT$260.'],
      outcome: 'share',
      finalFare: 260,
    }),
    rider('Chiang', {
      theater: ['Your fare is NT$280.'],
      outcome: 'solo',
      kicked: true,
      finalFare: 280,
    }),
  ],
}

describe('negotiate skip', () => {
  it('collecting 不可 Skip 進 Pay', () => {
    expect(isMatchReady(collecting, 'Yu')).toBe(false)
    expect(canSkipToPay(collecting, 'Yu')).toBe(false)
  })

  it('settled 可立刻進 Pay', () => {
    expect(isMatchReady(settled, 'Yu')).toBe(true)
    expect(canSkipToPay(settled, 'Yu')).toBe(true)
  })

  it('solo 狀態也算成交', () => {
    const solo: MatchRecord = { ...settled, status: 'solo', adopted: 'solo' }
    expect(isMatchReady(solo, 'Yu')).toBe(true)
    expect(canSkipToPay(solo, 'Yu')).toBe(true)
  })
})

describe('own theater', () => {
  it('只回自己的對白', () => {
    expect(ownTheater(settled, 'Yu')).toEqual([
      'I scored this shared plan against your walls only.',
      'Your fare is NT$144.',
    ])
  })

  it('對白不含別人的 username 與 NT$', () => {
    const blob = ownTheater(settled, 'Yu').join(' ')
    expect(blob).not.toMatch(/Lin|Chiang|Yang/)
    expect(blob).toContain('NT$144')
    expect(blob).not.toContain('NT$260')
    expect(blob).not.toContain('NT$280')
  })
})

describe('pay view', () => {
  it('人數只數 outcome share；車資只讀自己的 finalFare', () => {
    const view = payView(settled, 'Yu')
    expect(view).toEqual({
      title: 'Negotiation result',
      plan: 'Shared taxi plan. Meter split after pickup.',
      shareCount: 2,
      fare: 144,
    })
    expect(sharePaxCount(settled)).toBe(2)
    expect(ownFare(settled, 'Yu')).toBe(144)
  })

  it('自己獨乘時文案 Solo taxi', () => {
    const view = payView(settled, 'Chiang')
    expect(view?.title).toBe('Solo taxi')
    expect(view?.plan).toBe('Solo taxi')
    expect(view?.fare).toBe(280)
    expect(view?.shareCount).toBe(2)
  })

  it('畫面字串不得出現別人的 NT$', () => {
    const view = payView(settled, 'Yu')
    if (!view) throw new Error('expected pay view')
    const text = payVisibleText(view)
    expect(text).toContain('NT$144')
    expect(text).not.toContain('NT$260')
    expect(text).not.toContain('NT$280')
    expect(text).not.toMatch(/Lin|Chiang|Yang/)
  })

  it('collecting 不給 Pay 視圖', () => {
    expect(payView(collecting, 'Yu')).toBeNull()
  })
})

describe('keepOwnMatch', () => {
  it('已成交後不吃新的 collecting', () => {
    expect(keepOwnMatch(settled, collecting, 'Yu')).toBe(settled)
  })

  it('尚未成交則用新檔', () => {
    expect(keepOwnMatch(collecting, settled, 'Yu')).toBe(settled)
  })

  it('新 collecting 成交且起訖相同則吃新檔', () => {
    const waiting: MatchRecord = {
      ...collecting,
      joins: [
        {
          username: 'Yu',
          demand: rider('Yu').demand,
          routePage: rider('Yu').routePage,
        },
      ],
      riders: [],
    }
    expect(keepOwnMatch(waiting, settled, 'Yu')).toBe(settled)
  })

  it('自己已在新 collecting 時不吃舊成交', () => {
    const waiting: MatchRecord = {
      ...collecting,
      joins: [
        {
          username: 'Yu',
          demand: rider('Yu').demand,
          routePage: {
            ...rider('Yu').routePage,
            dropoff: { id: 'new-d', name: 'New D', address: '', lat: 24.79, lng: 120.99 },
            notes: 'new dropoff run',
          },
        },
      ],
      riders: [],
    }
    expect(keepOwnMatch(waiting, settled, 'Yu')).toBe(waiting)
  })
})

describe('THEATER_LINE_MS', () => {
  it('一句約 700ms', () => {
    expect(THEATER_LINE_MS).toBe(700)
  })
})
