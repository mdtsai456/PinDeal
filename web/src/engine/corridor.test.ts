import { describe, expect, it } from 'vitest'
import { POSTER_RIDERS } from '../data'
import { placeById } from '../geo'
import {
  circlesIntersect,
  commonMeetPoint,
  groupHasCommonIntersection,
  haversineKm,
  riderCircles,
  walkRadiusKm,
  type Circle,
} from './corridor'

describe('walkRadiusKm', () => {
  it('8 分等於 0.64 公里', () => {
    expect(walkRadiusKm(8)).toBe(0.64)
  })

  it('0 分半徑為 0', () => {
    expect(walkRadiusKm(0)).toBe(0)
  })
})

describe('circlesIntersect', () => {
  const origin: Circle = { lat: 24.8018, lng: 120.9717, radiusKm: 0.5 }

  it('距離 0 相交', () => {
    expect(circlesIntersect(origin, { ...origin, radiusKm: 0 })).toBe(true)
  })

  it('剛好在半徑上算在圈內', () => {
    const east = { lat: 24.8018, lng: 120.97665, radiusKm: 0 }
    const dist = haversineKm(origin, east)
    const onRim: Circle = { ...east, radiusKm: 0 }
    const cover: Circle = { ...origin, radiusKm: dist }
    expect(circlesIntersect(cover, onRim)).toBe(true)
  })

  it('超出不相交', () => {
    const far: Circle = { lat: 24.81, lng: 120.99, radiusKm: 0.2 }
    expect(circlesIntersect(origin, far)).toBe(false)
  })
})

describe('groupHasCommonIntersection', () => {
  it('兩圓相交但第三人圓心不在共同區則失敗', () => {
    const a: Circle = { lat: 24.8, lng: 120.97, radiusKm: 0.45 }
    const b: Circle = { lat: 24.8, lng: 120.976, radiusKm: 0.45 }
    const c: Circle = { lat: 24.807, lng: 120.973, radiusKm: 0.45 }
    expect(circlesIntersect(a, b)).toBe(true)
    expect(circlesIntersect(a, c)).toBe(true)
    expect(circlesIntersect(b, c)).toBe(true)
    expect(groupHasCommonIntersection([a, b, c])).toBe(false)
  })

  it('四人預設上車圈與下車圈都有共同交集', () => {
    const origins = (['A', 'B', 'C', 'D'] as const).map((id) => {
      const rider = POSTER_RIDERS[id]
      return riderCircles(
        placeById(rider.originId),
        placeById(rider.destinationId),
        rider.maxWalkMin,
      ).origin
    })
    const dests = (['A', 'B', 'C', 'D'] as const).map((id) => {
      const rider = POSTER_RIDERS[id]
      return riderCircles(
        placeById(rider.originId),
        placeById(rider.destinationId),
        rider.maxWalkMin,
      ).dest
    })
    expect(groupHasCommonIntersection(origins)).toBe(true)
    expect(groupHasCommonIntersection(dests)).toBe(true)
  })
})

function inCircle(point: { lat: number; lng: number }, circle: Circle): boolean {
  return haversineKm(point, circle) <= circle.radiusKm + 1e-9
}

describe('commonMeetPoint', () => {
  it('0 圈回 null，1 圈回圓心', () => {
    expect(commonMeetPoint([])).toBeNull()
    const only: Circle = { lat: 24.8, lng: 120.97, radiusKm: 0.4 }
    expect(commonMeetPoint([only])).toEqual({ lat: only.lat, lng: only.lng })
  })

  it('兩圓半徑不等、圓心平均不在小圈內時，回點仍在兩圈內', () => {
    const large: Circle = { lat: 24.8, lng: 120.97, radiusKm: 1 }
    const small: Circle = { lat: 24.81081, lng: 120.97, radiusKm: 0.3 }
    const mean = {
      lat: (large.lat + small.lat) / 2,
      lng: (large.lng + small.lng) / 2,
    }
    expect(inCircle(mean, small)).toBe(false)
    expect(circlesIntersect(large, small)).toBe(true)
    const meet = commonMeetPoint([large, small])
    expect(meet).not.toBeNull()
    if (!meet) return
    expect(inCircle(meet, large)).toBe(true)
    expect(inCircle(meet, small)).toBe(true)
  })

  it('三人兩兩相交但無共同點回 null', () => {
    const a: Circle = { lat: 24.8, lng: 120.97, radiusKm: 0.45 }
    const b: Circle = { lat: 24.8, lng: 120.976, radiusKm: 0.45 }
    const c: Circle = { lat: 24.807, lng: 120.973, radiusKm: 0.45 }
    expect(groupHasCommonIntersection([a, b, c])).toBe(false)
    expect(commonMeetPoint([a, b, c])).toBeNull()
  })

  it('四人預設走廊兩端都有點且落在每一圈內', () => {
    const origins = (['A', 'B', 'C', 'D'] as const).map((id) => {
      const rider = POSTER_RIDERS[id]
      return riderCircles(
        placeById(rider.originId),
        placeById(rider.destinationId),
        rider.maxWalkMin,
      ).origin
    })
    const dests = (['A', 'B', 'C', 'D'] as const).map((id) => {
      const rider = POSTER_RIDERS[id]
      return riderCircles(
        placeById(rider.originId),
        placeById(rider.destinationId),
        rider.maxWalkMin,
      ).dest
    })
    const pickup = commonMeetPoint(origins)
    const dropoff = commonMeetPoint(dests)
    expect(pickup).not.toBeNull()
    expect(dropoff).not.toBeNull()
    if (!pickup || !dropoff) return
    for (const circle of origins) expect(inCircle(pickup, circle)).toBe(true)
    for (const circle of dests) expect(inCircle(dropoff, circle)).toBe(true)
  })
})
