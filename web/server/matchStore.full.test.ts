import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cloneRider } from '../src/data.ts'
import { usernameForRider, runMatch } from '../src/engine/match.ts'
import { snapshotRoutePage, type MatchJoinBody } from '../src/engine/routePage.ts'
import { placeById } from '../src/geo.ts'
import type { RiderDemand, RiderId } from '../src/types.ts'
import { flushHold, joinMatch, readMatch } from './matchStore.ts'

function pageFromDemand(demand: RiderDemand) {
  return snapshotRoutePage({
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
  })
}

function joinBody(id: RiderId): MatchJoinBody {
  const demand = cloneRider(id)
  return { username: usernameForRider(id), demand, routePage: pageFromDemand(demand) }
}

describe('matchStore 滿員與再加入', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sharemeter-full-'))
    filePath = path.join(dir, 'current.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('collecting 已有 A/B/C/D 時 flush 先成交，團員再 join 回原檔', async () => {
    const lastJoinAt = '2026-09-20T00:00:00.000Z'
    writeFileSync(
      filePath,
      JSON.stringify({
        id: 'current',
        status: 'collecting',
        adopted: 'solo',
        joins: [joinBody('A'), joinBody('B'), joinBody('C'), joinBody('D')],
        riders: [],
        sharePlan: null,
        lastJoinAt,
      }),
    )
    const flushed = await flushHold(filePath)
    expect(['settled', 'solo']).toContain(flushed.status)
    expect(flushed.riders).toHaveLength(4)
    expect(readMatch(filePath).status).toBe(flushed.status)
    const again = await joinMatch(filePath, joinBody('D'))
    expect(again.status).toBe(flushed.status)
    expect(again.riders).toHaveLength(4)
  })

  it('已成交團員再 join 回原檔，不報 match_full', async () => {
    const four = runMatch(
      (['A', 'B', 'C', 'D'] as const).map((id) => ({
        username: usernameForRider(id),
        demand: cloneRider(id),
        routePage: pageFromDemand(cloneRider(id)),
      })),
    )
    writeFileSync(filePath, JSON.stringify(four))
    const again = await joinMatch(filePath, joinBody('A'))
    expect(again.status).toBe(four.status)
    expect(again.riders).toHaveLength(4)
    expect(again.riders.map((rider) => rider.username)).toEqual(four.riders.map((rider) => rider.username))
  })
})
