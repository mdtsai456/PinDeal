import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import {
  DEMO_CRUISE_KMH,
  delaySecFromTrip,
  extraDistanceJumps,
  HSINCHU_TAXI,
  hsinchuMeter,
  soloFareFromDemand,
  waitJumps,
} from './taxiTariff'

describe('HSINCHU_TAXI', () => {
  it('起跳與續程與延滯用市交通處數字', () => {
    expect(HSINCHU_TAXI.flagNt).toBe(100)
    expect(HSINCHU_TAXI.flagKm).toBe(1.25)
    expect(HSINCHU_TAXI.incrementM).toBe(200)
    expect(HSINCHU_TAXI.incrementNt).toBe(5)
    expect(HSINCHU_TAXI.waitSec).toBe(80)
    expect(HSINCHU_TAXI.waitNt).toBe(5)
  })
})

describe('extraDistanceJumps', () => {
  it('未超過起跳是 0', () => {
    expect(extraDistanceJumps(1.25)).toBe(0)
    expect(extraDistanceJumps(0.4)).toBe(0)
  })

  it('剛過起跳跳 1 格', () => {
    expect(extraDistanceJumps(1.2501)).toBe(1)
  })

  it('Yu 3.2 km 與 Lin 2.6 km', () => {
    expect(extraDistanceJumps(3.2)).toBe(10)
    expect(extraDistanceJumps(2.6)).toBe(7)
  })
})

describe('waitJumps', () => {
  it('未滿 80 秒不跳', () => {
    expect(waitJumps(0)).toBe(0)
    expect(waitJumps(79)).toBe(0)
    expect(waitJumps(80)).toBe(1)
    expect(waitJumps(160)).toBe(2)
  })
})

describe('hsinchuMeter', () => {
  it('起跳內是 100', () => {
    expect(hsinchuMeter({ distanceKm: 1.0 })).toBe(100)
    expect(hsinchuMeter({ distanceKm: 1.25 })).toBe(100)
  })

  it('距離-only：Yu 150、Lin 135', () => {
    expect(hsinchuMeter({ distanceKm: 3.2 })).toBe(150)
    expect(hsinchuMeter({ distanceKm: 2.6 })).toBe(135)
  })

  it('延滯與夜間可加在距離之上', () => {
    expect(hsinchuMeter({ distanceKm: 1.25, delaySec: 80 })).toBe(105)
    expect(hsinchuMeter({ distanceKm: 1.25, night: true })).toBe(120)
  })
})

describe('soloFareFromDemand', () => {
  it('Yu 預設新竹起迄不是 420', () => {
    const fare = soloFareFromDemand(cloneRider('A'))
    expect(fare).not.toBe(420)
    expect(fare).toBeGreaterThan(0)
  })
})

describe('delaySecFromTrip', () => {
  it('現走廊 Yu／Lin 延滯是 0', () => {
    expect(DEMO_CRUISE_KMH).toBe(30)
    expect(delaySecFromTrip(3.2, 6)).toBe(0)
    expect(delaySecFromTrip(2.6, 5)).toBe(0)
  })

  it('時間明顯長於巡航才有延滯', () => {
    expect(delaySecFromTrip(2.4, 12)).toBeGreaterThanOrEqual(80)
  })
})
