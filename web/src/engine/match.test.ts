import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import {
  adoptVersion,
  hitsWall,
  majorityNeeded,
  normalizeUsername,
  pitchFromDemand,
  runMatch,
  scoreOffer,
  splitBySolo,
  USERNAME_TO_RIDER,
  usernameForRider,
  type MatchSeed,
  type OfferSlice,
  type WallInput,
} from './match'
import { placeById } from '../geo'
import { snapshotRoutePage } from './routePage'
import { planShareRoute } from './shareRoute'

function slice(partial: Partial<OfferSlice> & Pick<OfferSlice, 'walkMin' | 'rideMin' | 'fare'>): OfferSlice {
  return {
    soloFare: 200,
    soloRideMin: 20,
    accessible: true,
    luggageOk: true,
    ...partial,
  }
}

const insideWalls: WallInput = {
  maxWalkMin: 8,
  maxDetourMin: 10,
  accessibility: false,
  luggageCount: 1,
}

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

describe('normalizeUsername', () => {
  it('yu 正規成 Yu', () => {
    expect(normalizeUsername('yu')).toBe('Yu')
  })

  it('YANG 正規成 Yang', () => {
    expect(normalizeUsername('YANG')).toBe('Yang')
  })

  it('未知字原樣返回', () => {
    expect(normalizeUsername('Chen')).toBe('Chen')
  })
})

describe('USERNAME_TO_RIDER', () => {
  it('Chiang 對到 C', () => {
    expect(USERNAME_TO_RIDER.Chiang).toBe('C')
  })
})

describe('hitsWall 與 scoreOffer', () => {
  it('walkMin 9 且 maxWalkMin 8 會撞牆，分數 0', () => {
    const offer = slice({ walkMin: 9, rideMin: 22, fare: 140 })
    expect(hitsWall(offer, insideWalls)).toBe(true)
    expect(scoreOffer(offer, insideWalls)).toBe(0)
  })

  it('fare 等於 soloFare 會撞牆', () => {
    const offer = slice({ walkMin: 4, rideMin: 22, fare: 200, soloFare: 200 })
    expect(hitsWall(offer, insideWalls)).toBe(true)
    expect(scoreOffer(offer, insideWalls)).toBe(0)
  })

  it('牆內且比獨乘便宜則分數大於 0', () => {
    const offer = slice({ walkMin: 4, rideMin: 22, fare: 140 })
    expect(hitsWall(offer, insideWalls)).toBe(false)
    expect(scoreOffer(offer, insideWalls)).toBeGreaterThan(0)
  })

  it('車上時間超過獨乘加 Extra time 會撞牆', () => {
    const offer = slice({ walkMin: 4, rideMin: 31, fare: 140, soloRideMin: 20 })
    expect(hitsWall(offer, { ...insideWalls, maxDetourMin: 10 })).toBe(true)
    expect(scoreOffer(offer, { ...insideWalls, maxDetourMin: 10 })).toBe(0)
  })

  it('需要無障礙但車不是無障礙會撞牆', () => {
    const offer = slice({ walkMin: 4, rideMin: 22, fare: 140, accessible: false })
    expect(hitsWall(offer, { ...insideWalls, accessibility: true })).toBe(true)
  })

  it('行李 2 件且 luggageOk 為 false 會撞牆', () => {
    const offer = slice({ walkMin: 4, rideMin: 22, fare: 140, luggageOk: false })
    expect(hitsWall(offer, { ...insideWalls, luggageCount: 2 })).toBe(true)
  })
})

describe('majorityNeeded 與 adoptVersion', () => {
  it('4 人要 3 票才用 v2，2 票仍用 v1', () => {
    expect(majorityNeeded(4)).toBe(3)
    expect(adoptVersion([1, 1, 1, 1], [2, 2, 2, 0])).toBe('v2')
    expect(adoptVersion([1, 1, 1, 1], [2, 2, 1, 1])).toBe('v1')
  })

  it('2 人必須 2 票', () => {
    expect(majorityNeeded(2)).toBe(2)
    expect(adoptVersion([1, 1], [2, 1])).toBe('v1')
    expect(adoptVersion([1, 1], [2, 2])).toBe('v2')
  })

  it('3 人要 2 票', () => {
    expect(majorityNeeded(3)).toBe(2)
    expect(adoptVersion([1, 1, 1], [2, 2, 0])).toBe('v2')
  })
})

describe('splitBySolo', () => {
  it('最後一格吃 residual，加總等於總跳表', () => {
    const fares = splitBySolo([200, 100, 100], 217)
    expect(fares.reduce((acc, fare) => acc + fare, 0)).toBe(217)
    expect(fares.at(-1)).toBe(217 - fares[0]! - fares[1]!)
  })
})

describe('pitchFromDemand', () => {
  it('依 priority 選軸', () => {
    expect(pitchFromDemand(cloneRider('A'))).toMatchObject({ axis: 'ontime', give: 'fare' })
    expect(pitchFromDemand(cloneRider('B'))).toMatchObject({ axis: 'fare', give: 'walk' })
    expect(pitchFromDemand(cloneRider('C'))).toMatchObject({ axis: 'walk', give: 'fare' })
    expect(pitchFromDemand(cloneRider('D'))).toMatchObject({ axis: 'ride', give: 'fare' })
  })
})

describe('runMatch', () => {
  it('兩人合法則 settled、共乘、車資低於獨乘', () => {
    const record = runMatch([seedFrom('A'), seedFrom('B')])
    expect(record.status).toBe('settled')
    expect(record.riders.every((rider) => rider.outcome === 'share')).toBe(true)
    for (const rider of record.riders) {
      expect(rider.finalFare).toBeLessThan(rider.v1.soloFare)
      expect(rider.kicked).toBe(false)
    }
  })

  it('v1 walkMin 來自共用走廊幾何，且不超過該人 maxWalkMin', () => {
    const seeds = [seedFrom('A'), seedFrom('B')]
    const record = runMatch(seeds)
    const plan = planShareRoute(
      seeds.map((seed) => ({
        riderId: USERNAME_TO_RIDER[seed.username],
        pickup: seed.routePage.pickup,
        dropoff: seed.routePage.dropoff,
        originCircle: seed.routePage.originCircle,
        destCircle: seed.routePage.destCircle,
        maxWalkMin: seed.routePage.maxWalkMin,
      })),
    )
    expect(plan).not.toBeNull()
    for (const rider of record.riders) {
      const snap = plan?.byRider[rider.riderId]
      expect(snap).toBeDefined()
      expect(rider.v1.walkMin).toBe(snap?.walkMin)
      expect(rider.v1.walkMin).toBeLessThanOrEqual(rider.routePage.maxWalkMin)
    }
  })

  it('多數採用 v2 後一人撞牆則踢出獨乘，留下 2 人重分', () => {
    const record = runMatch([
      seedFrom('A', { maxDetourMin: 5, priority: 'time' }),
      seedFrom('B', { maxWalkMin: 1, maxDetourMin: 18, priority: 'price' }),
      seedFrom('C', { maxWalkMin: 6, maxDetourMin: 15, priority: 'comfort' }),
    ])
    const lin = record.riders.find((rider) => rider.username === 'Lin')
    const others = record.riders.filter((rider) => rider.username !== 'Lin')
    expect(record.adopted).toBe('v2')
    expect(record.status).toBe('settled')
    expect(lin?.kicked).toBe(true)
    expect(lin?.outcome).toBe('solo')
    expect(lin?.finalFare).toBe(lin?.v1.soloFare)
    expect(others).toHaveLength(2)
    expect(others.every((rider) => rider.outcome === 'share')).toBe(true)
    const sharedMeter = others.reduce((acc, rider) => acc + rider.finalFare, 0)
    expect(sharedMeter).toBe(Math.round(0.72 * others.reduce((acc, rider) => acc + rider.v1.soloFare, 0)))
  })

  it('踢完剩不到 2 人則全員獨乘', () => {
    const record = runMatch([seedFrom('A')])
    expect(record.status).toBe('solo')
    expect(record.adopted).toBe('solo')
    expect(record.riders[0]?.outcome).toBe('solo')
    expect(record.riders[0]?.finalFare).toBe(record.riders[0]?.v1.soloFare)
  })

  it('四人合法可 settled，多數門檻仍是 3 票', () => {
    const record = runMatch([seedFrom('A'), seedFrom('B'), seedFrom('C'), seedFrom('D')])
    expect(record.riders).toHaveLength(4)
    expect(['settled', 'solo']).toContain(record.status)
    expect(record.riders.filter((rider) => rider.scoreV2 > rider.scoreV1).length >= 3).toBe(
      record.adopted === 'v2',
    )
  })
})
