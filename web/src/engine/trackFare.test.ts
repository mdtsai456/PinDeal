import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import type { MatchRecord } from './match'
import { ownFare, payView, trackFare } from './matchView'
import { soloFareFromDemand } from './taxiTariff'

const yuSolo = soloFareFromDemand(cloneRider('A'))

const settled = {
  id: 'current',
  status: 'settled',
  adopted: 'v1',
  riders: [
    { username: 'Yu', outcome: 'share', finalFare: 144 },
    { username: 'Lin', outcome: 'share', finalFare: 260 },
  ],
  lastJoinAt: null,
} as MatchRecord

const collecting = {
  id: 'current',
  status: 'collecting',
  adopted: 'solo',
  riders: [{ username: 'Yu', outcome: 'solo', finalFare: 0 }],
  lastJoinAt: null,
} as MatchRecord

describe('trackFare', () => {
  it('Yu 預設新竹獨乘不是 420', () => {
    expect(yuSolo).not.toBe(420)
    expect(yuSolo).toBeGreaterThan(0)
  })

  it('無 match 時用該獨乘，不是 0', () => {
    expect(trackFare(null, 'Yu', yuSolo)).toBe(yuSolo)
    expect(trackFare(null, 'Yu', yuSolo)).not.toBe(0)
  })

  it('collecting 用該獨乘，不用 ownFare 的 0', () => {
    expect(ownFare(collecting, 'Yu')).toBe(0)
    expect(payView(collecting, 'Yu')).toBeNull()
    expect(trackFare(collecting, 'Yu', yuSolo)).toBe(yuSolo)
    expect(trackFare(collecting, 'Yu', yuSolo)).not.toBe(0)
  })

  it('成交後等於 payView.fare 與 ownFare，且不是別人的車資', () => {
    const view = payView(settled, 'Yu')
    expect(view?.fare).toBe(144)
    expect(ownFare(settled, 'Yu')).toBe(144)
    expect(trackFare(settled, 'Yu', yuSolo)).toBe(144)
    expect(trackFare(settled, 'Yu', yuSolo)).not.toBe(260)
  })

  it('solo 狀態也讀自己的 finalFare', () => {
    const solo = { ...settled, status: 'solo', adopted: 'solo' } as MatchRecord
    expect(trackFare(solo, 'Yu', yuSolo)).toBe(144)
  })
})
