import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import { runMatch, USERNAME_TO_RIDER, usernameForRider, type MatchSeed } from './match'
import { placeById } from '../geo'
import { snapshotRoutePage } from './routePage'
import { planShareRoute } from './shareRoute'

function seedFrom(id: 'A' | 'B' | 'C' | 'D', patch: Partial<ReturnType<typeof cloneRider>> = {}): MatchSeed {
  const demand = { ...cloneRider(id), ...patch }
  return {
    username: usernameForRider(id),
    demand,
    routePage: snapshotRoutePage({
      pickup: placeById(demand.originId),
      dropoff: placeById(demand.destinationId),
      soloDurationMin: 12,
      soloDistanceKm: 2.4,
      extraTimeMin: demand.maxDetourMin,
      maxWalkMin: demand.maxWalkMin,
      bags: demand.luggageCount,
      accessible: demand.accessibility,
      extraPay: demand.extraPay,
      notes: demand.rawText,
    }),
  }
}

function inputsOf(seeds: MatchSeed[]) {
  return seeds.map((seed) => ({
    riderId: USERNAME_TO_RIDER[seed.username],
    pickup: seed.routePage.pickup,
    dropoff: seed.routePage.dropoff,
    originCircle: seed.routePage.originCircle,
    destCircle: seed.routePage.destCircle,
    maxWalkMin: seed.routePage.maxWalkMin,
  }))
}

describe('runMatch sharePlan', () => {
  it('兩人共乘且未踢人時，sharePlan 步行等於 v1 與 finalWalkMin', () => {
    const seeds = [seedFrom('A'), seedFrom('B')]
    const record = runMatch(seeds)
    const planned = planShareRoute(inputsOf(seeds))
    expect(record.status).toBe('settled')
    expect(record.adopted).toBe('v1')
    expect(record.sharePlan).not.toBeNull()
    expect(planned).not.toBeNull()
    expect(record.sharePlan?.spineA).toEqual(planned?.spineA)
    expect(record.sharePlan?.spineB).toEqual(planned?.spineB)
    for (const rider of record.riders) {
      const snap = record.sharePlan?.byRider[rider.riderId]
      const plannedSnap = planned?.byRider[rider.riderId]
      expect(snap?.walkMin).toBe(plannedSnap?.walkMin)
      expect(rider.v1.walkMin).toBe(snap?.walkMin)
      expect(rider.finalWalkMin).toBe(rider.v1.walkMin)
    }
  })

  it('走廊無計畫時 runMatch 回 solo，且不寫 sharePlan', () => {
    const far = seedFrom('B')
    far.routePage = snapshotRoutePage({
      pickup: { id: 'far-p', name: 'Far pickup', address: '', lat: 25.0478, lng: 121.517 },
      dropoff: { id: 'far-d', name: 'Far dropoff', address: '', lat: 25.0674, lng: 121.6147 },
      soloDurationMin: 25,
      soloDistanceKm: 8,
      extraTimeMin: far.demand.maxDetourMin,
      maxWalkMin: 8,
      bags: far.demand.luggageCount,
      accessible: far.demand.accessibility,
      extraPay: far.demand.extraPay,
      notes: far.demand.rawText,
    })
    const record = runMatch([seedFrom('A'), far])
    expect(planShareRoute(inputsOf([seedFrom('A'), far]))).toBeNull()
    expect(record.status).toBe('solo')
    expect(record.adopted).toBe('solo')
    expect(record.sharePlan).toBeNull()
    expect(record.riders.every((rider) => rider.outcome === 'solo')).toBe(true)
  })

  it('踢人後剩餘 finalWalkMin 與 sharePlan 來自剩餘計畫，不是原三人計畫', () => {
    const seeds = [
      seedFrom('A', { maxDetourMin: 5, priority: 'time' }),
      seedFrom('B', { maxWalkMin: 1, maxDetourMin: 18, priority: 'price' }),
      seedFrom('C', { maxWalkMin: 6, maxDetourMin: 15, priority: 'comfort' }),
    ]
    const record = runMatch(seeds)
    const remaining = record.riders.filter((rider) => !rider.kicked)
    const originalPlan = planShareRoute(inputsOf(seeds))
    const remainingSeeds = seeds.filter((seed) => remaining.some((rider) => rider.username === seed.username))
    const remainingPlan = planShareRoute(inputsOf(remainingSeeds))
    expect(record.adopted).toBe('v2')
    expect(record.status).toBe('settled')
    expect(remaining).toHaveLength(2)
    expect(remainingPlan).not.toBeNull()
    expect(originalPlan).not.toBeNull()
    expect(record.sharePlan?.spineA).toEqual(remainingPlan?.spineA)
    expect(record.sharePlan?.spineB).toEqual(remainingPlan?.spineB)
    expect(record.sharePlan?.byRider.B).toBeUndefined()
    expect(originalPlan?.byRider.B).toBeDefined()
    for (const rider of remaining) {
      expect(rider.outcome).toBe('share')
      expect(rider.finalWalkMin).toBe(remainingPlan?.byRider[rider.riderId]?.walkMin)
    }
    const sharedMeter = remaining.reduce((acc, rider) => acc + rider.finalFare, 0)
    const soloSum = remaining.reduce((acc, rider) => acc + rider.v1.soloFare, 0)
    expect(sharedMeter).toBe(Math.round(0.72 * soloSum))
  })
})
