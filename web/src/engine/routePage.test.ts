import { describe, expect, it } from 'vitest'
import { PLACES } from '../data'
import { walkRadiusKm } from './corridor'
import { snapshotRoutePage } from './routePage'

describe('snapshotRoutePage', () => {
  const pickup = PLACES.hsinchuStation
  const dropoff = PLACES.nthuGym

  it('欄位與 Your route 畫面列對齊', () => {
    const page = snapshotRoutePage({
      pickup,
      dropoff,
      soloDurationMin: 11,
      soloDistanceKm: 2.3,
      extraTimeMin: 20,
      maxWalkMin: 8,
      bags: 1,
      accessible: false,
      extraPay: true,
      notes: 'Arrive by 21:40.',
    })
    expect(page.pickup).toEqual(pickup)
    expect(page.dropoff).toEqual(dropoff)
    expect(page.soloDurationMin).toBe(11)
    expect(page.soloDistanceKm).toBe(2.3)
    expect(page.extraTimeMin).toBe(20)
    expect(page.sharedCapMin).toBe(31)
    expect(page.maxWalkMin).toBe(8)
    expect(page.bags).toBe(1)
    expect(page.accessible).toBe(false)
    expect(page.extraPay).toBe(true)
    expect(page.notes).toBe('Arrive by 21:40.')
  })

  it('兩圈半徑跟 Max walk', () => {
    const page = snapshotRoutePage({
      pickup,
      dropoff,
      soloDurationMin: 11,
      soloDistanceKm: 2.3,
      extraTimeMin: 8,
      maxWalkMin: 8,
      bags: 0,
      accessible: false,
      extraPay: false,
      notes: '',
    })
    expect(page.originCircle.lat).toBe(pickup.lat)
    expect(page.originCircle.lng).toBe(pickup.lng)
    expect(page.destCircle.lat).toBe(dropoff.lat)
    expect(page.destCircle.lng).toBe(dropoff.lng)
    expect(page.originCircle.radiusKm).toBe(walkRadiusKm(8))
    expect(page.destCircle.radiusKm).toBe(walkRadiusKm(8))
  })
})
