import { describe, expect, it } from 'vitest'
import { estimateDurationMin, haversineKm, osrmCoords, straightRoute } from './directions'
import { PLACES } from './data'

describe('haversineKm', () => {
  it('is ~0 for the same point', () => {
    const p = { lat: 24.8, lng: 120.97 }
    expect(haversineKm(p, p)).toBeCloseTo(0, 5)
  })

  it('is about 2 km from Hsinchu Station to NTHU Gym', () => {
    const km = haversineKm(PLACES.hsinchuStation, PLACES.nthuGym)
    expect(km).toBeGreaterThan(1.5)
    expect(km).toBeLessThan(4)
  })
})

describe('estimateDurationMin', () => {
  it('uses urban taxi speed and never returns 0', () => {
    expect(estimateDurationMin(0)).toBe(1)
    expect(estimateDurationMin(14)).toBe(30)
  })
})

describe('straightRoute', () => {
  it('keeps only pickup and dropoff', () => {
    const route = straightRoute(PLACES.hsinchuStation, PLACES.nthuGym)
    expect(route.polyline).toHaveLength(2)
    expect(route.source).toBe('straight')
    expect(route.durationMin).toBeGreaterThan(0)
  })

  it('adds via length into the fallback', () => {
    const direct = straightRoute(PLACES.hsinchuStation, PLACES.nthuGym)
    const withVia = straightRoute(PLACES.hsinchuStation, PLACES.nthuGym, [PLACES.taipeiMain])
    expect(withVia.polyline).toHaveLength(3)
    expect(withVia.distanceKm).toBeGreaterThan(direct.distanceKm)
  })
})

describe('osrmCoords', () => {
  it('joins lng,lat pairs for the public router', () => {
    expect(osrmCoords([PLACES.hsinchuStation, PLACES.nthuGym])).toBe(
      `${PLACES.hsinchuStation.lng},${PLACES.hsinchuStation.lat};${PLACES.nthuGym.lng},${PLACES.nthuGym.lat}`,
    )
  })
})
