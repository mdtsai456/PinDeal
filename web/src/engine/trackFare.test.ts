import { describe, expect, it } from 'vitest'
import type { MatchRecord } from './match'
import { ownFare, payView, trackFare } from './matchView'

const settled = {
  id: 'current',
  status: 'settled',
  adopted: 'v1',
  riders: [
    { username: 'Yu', outcome: 'share', finalFare: 144 },
    { username: 'Lin', outcome: 'share', finalFare: 260 },
  ],
} as MatchRecord

const collecting = {
  id: 'current',
  status: 'collecting',
  adopted: 'solo',
  riders: [{ username: 'Yu', outcome: 'solo', finalFare: 0 }],
} as MatchRecord

describe('trackFare', () => {
  it('無 match 時保留 fallback youFare', () => {
    expect(trackFare(null, 'Yu', 420)).toBe(420)
  })

  it('collecting 保留 fallback，不用 ownFare 的 0', () => {
    expect(ownFare(collecting, 'Yu')).toBe(0)
    expect(payView(collecting, 'Yu')).toBeNull()
    expect(trackFare(collecting, 'Yu', 420)).toBe(420)
  })

  it('成交後等於 payView.fare 與 ownFare，且不是別人的車資', () => {
    const view = payView(settled, 'Yu')
    expect(view?.fare).toBe(144)
    expect(ownFare(settled, 'Yu')).toBe(144)
    expect(trackFare(settled, 'Yu', 420)).toBe(144)
    expect(trackFare(settled, 'Yu', 420)).not.toBe(260)
  })

  it('solo 狀態也讀自己的 finalFare', () => {
    const solo = { ...settled, status: 'solo', adopted: 'solo' } as MatchRecord
    expect(trackFare(solo, 'Yu', 420)).toBe(144)
  })
})
