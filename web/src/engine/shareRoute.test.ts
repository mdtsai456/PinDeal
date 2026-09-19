import { describe, expect, it } from 'vitest'
import { PLACES } from '../data'
import { riderCircles } from './corridor'
import { planShareRoute, walkMinBetween, type ShareRiderInput } from './shareRoute'

const yuP = PLACES.hsinchuStation
const yuD = PLACES.nthuGym
const linP = PLACES.hsinchuBeida
const linD = PLACES.nthuLibrary
const chiangP = PLACES.hsinchuDongmen
const chiangD = PLACES.nthuMainGate

function inputOf(
  riderId: ShareRiderInput['riderId'],
  pickup: typeof yuP,
  dropoff: typeof yuD,
  maxWalkMin: number,
): ShareRiderInput {
  const circles = riderCircles(pickup, dropoff, maxWalkMin)
  return {
    riderId,
    pickup,
    dropoff,
    originCircle: circles.origin,
    destCircle: circles.dest,
    maxWalkMin,
  }
}

describe('planShareRoute', () => {
  it('少於 2 人或圈無交集則回 null', () => {
    expect(planShareRoute([inputOf('A', yuP, yuD, 8)])).toBeNull()
    const far = {
      ...inputOf('B', linP, linD, 1),
      originCircle: { lat: 25.0, lng: 121.5, radiusKm: 0.08 },
    }
    expect(planShareRoute([inputOf('A', yuP, yuD, 8), far])).toBeNull()
  })

  it('同一走廊端點，每人在自己 Max walk 內扣到軸上', () => {
    const plan = planShareRoute([
      inputOf('A', yuP, yuD, 8),
      inputOf('B', linP, linD, 10),
      inputOf('C', chiangP, chiangD, 6),
    ])
    expect(plan).not.toBeNull()
    if (!plan) return
    const yu = plan.byRider.A
    const lin = plan.byRider.B
    const chiang = plan.byRider.C
    expect(yu).toBeDefined()
    expect(lin).toBeDefined()
    expect(chiang).toBeDefined()
    if (!yu || !lin || !chiang) return
    expect(yu.walkMin).toBe(Math.max(walkMinBetween(yuP, yu.board), walkMinBetween(yuD, yu.alight)))
    expect(lin.walkMin).toBe(Math.max(walkMinBetween(linP, lin.board), walkMinBetween(linD, lin.alight)))
    expect(yu.walkMin).toBeLessThanOrEqual(8)
    expect(lin.walkMin).toBeLessThanOrEqual(10)
    expect(chiang.walkMin).toBeLessThanOrEqual(6)
  })
})
