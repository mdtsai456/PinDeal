import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cloneRider, PLACES } from '../src/data.ts'
import { commonMeetPoint, groupHasCommonIntersection, type Circle } from '../src/engine/corridor.ts'
import { usernameForRider } from '../src/engine/match.ts'
import { snapshotRoutePage, type MatchJoinBody } from '../src/engine/routePage.ts'
import { planShareRoute } from '../src/engine/shareRoute.ts'
import { placeById } from '../src/geo.ts'
import type { Place, RiderDemand, RiderId } from '../src/types.ts'
import { flushHold, joinMatch, JoinMatchError, readMatch } from './matchStore.ts'

function pageFrom(
  demand: RiderDemand,
  pickup: Place,
  dropoff: Place,
) {
  return snapshotRoutePage({
    pickup,
    dropoff,
    soloDurationMin: 12,
    soloDistanceKm: 2.4,
    extraTimeMin: demand.maxDetourMin,
    maxWalkMin: demand.maxWalkMin,
    bags: demand.luggageCount,
    accessible: demand.accessibility,
    extraPay: demand.extraPay,
    notes: demand.rawText,
  })
}

function joinAt(id: RiderId, pickup: Place, dropoff: Place, maxWalkMin = 8): MatchJoinBody {
  const demand = { ...cloneRider(id), maxWalkMin }
  return {
    username: usernameForRider(id),
    demand,
    routePage: pageFrom(demand, pickup, dropoff),
  }
}

function corridorJoin(id: RiderId): MatchJoinBody {
  const demand = cloneRider(id)
  return {
    username: usernameForRider(id),
    demand,
    routePage: pageFrom(demand, placeById(demand.originId), placeById(demand.destinationId)),
  }
}

function offsetKm(origin: { lat: number; lng: number }, eastKm: number, northKm: number): { lat: number; lng: number } {
  const latKm = 111.32
  const lngKm = 111.32 * Math.cos((origin.lat * Math.PI) / 180)
  return {
    lat: origin.lat + northKm / latKm,
    lng: origin.lng + eastKm / lngKm,
  }
}

function placeAt(id: string, name: string, point: { lat: number; lng: number }): Place {
  return { id, name, address: '', lat: point.lat, lng: point.lng }
}

// 三圓兩兩相交。圓心平均在三圈內。沒有任一圓心落在另外兩圈內。
function threeCircleJoinBodies(): { bodies: MatchJoinBody[]; origins: Circle[] } {
  const radiusKm = 0.64
  const sideKm = 1.5 * radiusKm
  const base = { lat: 24.8018, lng: 120.9717 }
  const pickups = [
    placeAt('tri-p-a', 'Tri A', base),
    placeAt('tri-p-b', 'Tri B', offsetKm(base, sideKm, 0)),
    placeAt('tri-p-c', 'Tri C', offsetKm(base, sideKm / 2, sideKm * Math.sqrt(3) / 2)),
  ]
  const destBase = PLACES.nthuGym
  const dropoffs = [
    destBase,
    placeAt('tri-d-b', 'Tri dest B', { lat: destBase.lat + 0.0004, lng: destBase.lng }),
    placeAt('tri-d-c', 'Tri dest C', { lat: destBase.lat, lng: destBase.lng + 0.0004 }),
  ]
  const ids = ['A', 'B', 'C'] as const
  const bodies = ids.map((id, index) => joinAt(id, pickups[index]!, dropoffs[index]!, 8))
  const origins = bodies.map((body) => body.routePage.originCircle)
  return { bodies, origins }
}

describe('join 幾何門', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sharemeter-geo-'))
    filePath = path.join(dir, 'current.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('新竹走廊兩人 join 後仍 collecting，idle 到期才成交', async () => {
    const t0 = Date.parse('2026-09-20T00:00:00.000Z')
    await joinMatch(filePath, corridorJoin('A'), { nowMs: t0 })
    const record = await joinMatch(filePath, corridorJoin('B'), { nowMs: t0 + 1000 })
    expect(record.status).toBe('collecting')
    expect(record.joins.map((join) => join.username)).toEqual(['Yu', 'Lin'])
    const settled = await flushHold(filePath, { nowMs: t0 + 16_000 })
    expect(settled.status).toBe('settled')
    expect(settled.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin'])
  })

  it('任一端圈不合則 walk_circles_miss，團仍 collecting', async () => {
    const first = await joinMatch(filePath, corridorJoin('A'))
    const farDest: Place = { id: 'far-d', name: 'Far dest', address: '', lat: 25.0674, lng: 121.6147 }
    const farPickup: Place = { id: 'far-p', name: 'Far pickup', address: '', lat: 25.0478, lng: 121.517 }
    const destMiss = joinAt('B', PLACES.hsinchuBeida, farDest, 8)
    await expect(joinMatch(filePath, destMiss)).rejects.toBeInstanceOf(JoinMatchError)
    await expect(joinMatch(filePath, destMiss)).rejects.toMatchObject({
      status: 409,
      error: 'walk_circles_miss',
    })
    expect(readMatch(filePath)).toEqual(first)

    const originMiss = joinAt('B', farPickup, PLACES.nthuLibrary, 8)
    await expect(joinMatch(filePath, originMiss)).rejects.toMatchObject({
      error: 'walk_circles_miss',
    })
    expect(readMatch(filePath)).toEqual(first)
  })

  it('三圓 groupHasCommonIntersection 為 false 且 commonMeetPoint 有值時仍可 join', async () => {
    const { bodies, origins } = threeCircleJoinBodies()
    expect(groupHasCommonIntersection(origins)).toBe(false)
    expect(commonMeetPoint(origins)).not.toBeNull()
    const dests = bodies.map((body) => body.routePage.destCircle)
    expect(commonMeetPoint(dests)).not.toBeNull()
    const planned = planShareRoute(
      bodies.map((body) => ({
        riderId: body.demand.id,
        pickup: body.routePage.pickup,
        dropoff: body.routePage.dropoff,
        originCircle: body.routePage.originCircle,
        destCircle: body.routePage.destCircle,
        maxWalkMin: body.routePage.maxWalkMin,
      })),
    )
    expect(planned).not.toBeNull()

    const t0 = Date.parse('2026-09-20T00:00:00.000Z')
    const first = await joinMatch(filePath, bodies[0]!, { nowMs: t0 })
    const second = bodies[1]!
    writeFileSync(
      filePath,
      JSON.stringify({
        ...first,
        joins: [bodies[0], second],
        riders: [],
        lastJoinAt: first.lastJoinAt,
      }),
    )

    const record = await joinMatch(filePath, bodies[2]!, { nowMs: t0 + 2000 })
    expect(record.status).toBe('collecting')
    expect(record.joins).toHaveLength(3)
    expect(record.joins.map((join) => join.username)).toEqual(['Yu', 'Lin', 'Chiang'])
    const settled = await flushHold(filePath, { nowMs: t0 + 17_000 })
    expect(settled.status).toBe('settled')
    expect(settled.riders).toHaveLength(3)
    expect(settled.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin', 'Chiang'])
  })
})
