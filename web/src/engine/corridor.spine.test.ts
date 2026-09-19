import { describe, expect, it } from 'vitest'
import {
  clampToCircle,
  haversineKm,
  personalMeetOnSpine,
  projectOntoSegment,
  type Circle,
} from './corridor'

const west = { lat: 24.8, lng: 120.97 }
const east = { lat: 24.8, lng: 120.98 }

function almostKm(a: number, b: number): void {
  expect(a).toBeCloseTo(b, 4)
}

describe('projectOntoSegment', () => {
  it('線段上的點回自己，t 在 0 到 1', () => {
    const mid = { lat: 24.8, lng: 120.975 }
    const hit = projectOntoSegment(mid, west, east)
    expect(hit.lat).toBeCloseTo(mid.lat)
    expect(hit.lng).toBeCloseTo(mid.lng)
    expect(hit.t).toBeCloseTo(0.5)
  })

  it('側向點投到最近的軸上點', () => {
    const north = { lat: 24.81, lng: 120.975 }
    const hit = projectOntoSegment(north, west, east)
    expect(hit.lat).toBeCloseTo(24.8)
    expect(hit.lng).toBeCloseTo(120.975)
    expect(hit.t).toBeCloseTo(0.5)
  })

  it('超出西端時夾到起點，t 為 0', () => {
    const beyond = { lat: 24.8, lng: 120.96 }
    const hit = projectOntoSegment(beyond, west, east)
    expect(hit.lat).toBeCloseTo(west.lat)
    expect(hit.lng).toBeCloseTo(west.lng)
    expect(hit.t).toBe(0)
  })

  it('超出東端時夾到終點，t 為 1', () => {
    const beyond = { lat: 24.8, lng: 120.99 }
    const hit = projectOntoSegment(beyond, west, east)
    expect(hit.lat).toBeCloseTo(east.lat)
    expect(hit.lng).toBeCloseTo(east.lng)
    expect(hit.t).toBe(1)
  })

  it('起訖重合時回起點，t 為 0', () => {
    const hit = projectOntoSegment(east, west, west)
    expect(hit).toEqual({ lat: west.lat, lng: west.lng, t: 0, tLine: 0 })
  })

  it('超出端點時 tLine 不夾，t 夾到 0 或 1', () => {
    const westOf = projectOntoSegment({ lat: 24.8, lng: 120.96 }, west, east)
    const eastOf = projectOntoSegment({ lat: 24.8, lng: 120.99 }, west, east)
    expect(westOf.t).toBe(0)
    expect(westOf.tLine).toBeLessThan(0)
    expect(eastOf.t).toBe(1)
    expect(eastOf.tLine).toBeGreaterThan(1)
  })
})

describe('clampToCircle', () => {
  const circle: Circle = { lat: 24.8, lng: 120.97, radiusKm: 0.5 }

  it('圓內點不變', () => {
    const inside = { lat: 24.801, lng: 120.971 }
    expect(haversineKm(circle, inside)).toBeLessThan(circle.radiusKm)
    expect(clampToCircle(inside, circle)).toEqual(inside)
  })

  it('圓心不變', () => {
    expect(clampToCircle({ lat: circle.lat, lng: circle.lng }, circle)).toEqual({
      lat: circle.lat,
      lng: circle.lng,
    })
  })

  it('圓外點拉到邊界', () => {
    const outside = { lat: 24.82, lng: 120.99 }
    expect(haversineKm(circle, outside)).toBeGreaterThan(circle.radiusKm)
    const hit = clampToCircle(outside, circle)
    almostKm(haversineKm(circle, hit), circle.radiusKm)
    const outVecLat = outside.lat - circle.lat
    const outVecLng = outside.lng - circle.lng
    const hitVecLat = hit.lat - circle.lat
    const hitVecLng = hit.lng - circle.lng
    expect(hitVecLat * outVecLng - hitVecLng * outVecLat).toBeCloseTo(0)
    expect(hitVecLat * outVecLat + hitVecLng * outVecLng).toBeGreaterThan(0)
  })
})

describe('personalMeetOnSpine', () => {
  const circle: Circle = { lat: 24.8, lng: 120.975, radiusKm: 0.4 }

  it('投影在圓內時用軸上點', () => {
    const door = { lat: 24.801, lng: 120.975 }
    const meet = personalMeetOnSpine(door, circle, west, east)
    const proj = projectOntoSegment(door, west, east)
    expect(meet.lat).toBeCloseTo(proj.lat)
    expect(meet.lng).toBeCloseTo(proj.lng)
    expect(haversineKm(circle, meet)).toBeLessThanOrEqual(circle.radiusKm + 1e-9)
  })

  it('投影在圓外時夾到圓邊', () => {
    const farCircle: Circle = { lat: 24.81, lng: 120.96, radiusKm: 0.3 }
    const door = { lat: farCircle.lat, lng: farCircle.lng }
    const proj = projectOntoSegment(door, west, east)
    expect(haversineKm(farCircle, proj)).toBeGreaterThan(farCircle.radiusKm)
    const meet = personalMeetOnSpine(door, farCircle, west, east)
    almostKm(haversineKm(farCircle, meet), farCircle.radiusKm)
  })
})
