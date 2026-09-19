import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cloneRider, PLACES } from '../src/data.ts'
import { usernameForRider, runMatch, type MatchRecord } from '../src/engine/match.ts'
import { snapshotRoutePage, type MatchJoinBody } from '../src/engine/routePage.ts'
import { placeById } from '../src/geo.ts'
import type { RiderDemand, RiderId } from '../src/types.ts'
import { joinMatch, readMatch, resetMatch, type TheaterRewriter } from './matchStore.ts'

const REAL_MATCH_FILE = `${path.sep}storage${path.sep}matches${path.sep}current.json`

function pageFromDemand(
  demand: RiderDemand,
  pickup = placeById(demand.originId),
  dropoff = placeById(demand.destinationId),
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

function joinBody(
  id: RiderId,
  routePage = pageFromDemand(cloneRider(id)),
): MatchJoinBody {
  const demand = cloneRider(id)
  return { username: usernameForRider(id), demand, routePage }
}

function farJoin(id: RiderId): MatchJoinBody {
  const demand = { ...cloneRider(id), maxWalkMin: 8 }
  return {
    username: usernameForRider(id),
    demand,
    routePage: snapshotRoutePage({
      pickup: PLACES.taipeiMain,
      dropoff: PLACES.nangang,
      soloDurationMin: 25,
      soloDistanceKm: 8,
      extraTimeMin: demand.maxDetourMin,
      maxWalkMin: 8,
      bags: demand.luggageCount,
      accessible: demand.accessibility,
      extraPay: demand.extraPay,
      notes: demand.rawText,
    }),
  }
}

describe('matchStore', () => {
  let dir: string
  let filePath: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sharemeter-match-'))
    filePath = path.join(dir, 'current.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('無檔時回空的 collecting，且不寫真實團檔', () => {
    const record = readMatch(filePath)
    expect(record).toEqual({
      id: 'current',
      status: 'collecting',
      adopted: 'solo',
      riders: [],
    })
    expect(existsSync(filePath)).toBe(false)
    expect(filePath.includes(REAL_MATCH_FILE)).toBe(false)
    expect(path.basename(dir).startsWith('sharemeter-match-')).toBe(true)
  })

  it('1 人 join 是 collecting，不跑 runMatch，Your route 入檔', async () => {
    const body = joinBody('A')
    const record = await joinMatch(filePath, body)
    expect(record.status).toBe('collecting')
    expect(record.adopted).toBe('solo')
    expect(record.riders).toHaveLength(1)
    expect(record.riders[0]?.username).toBe('Yu')
    expect(record.riders[0]?.routePage).toEqual(body.routePage)
    expect(record.riders[0]?.demand).toEqual(body.demand)
    expect(record.riders[0]?.theater).toEqual([])
    expect(record.riders[0]?.scoreV1).toBe(0)
    expect(record.riders[0]?.scoreV2).toBe(0)
    const saved = JSON.parse(readFileSync(filePath, 'utf8')) as MatchRecord
    expect(saved.riders[0]?.routePage.notes).toBe(body.routePage.notes)
    expect(saved.riders[0]?.routePage.originCircle).toEqual(body.routePage.originCircle)
  })

  it('2 人兩端圈有交集則 runMatch，狀態由引擎決定', async () => {
    await joinMatch(filePath, joinBody('A'))
    const record = await joinMatch(filePath, joinBody('B'))
    const engine = runMatch([
      { username: 'Yu', demand: cloneRider('A'), routePage: pageFromDemand(cloneRider('A')) },
      { username: 'Lin', demand: cloneRider('B'), routePage: pageFromDemand(cloneRider('B')) },
    ])
    expect(record.status).toBe(engine.status)
    expect(['settled', 'solo']).toContain(record.status)
    expect(record.riders).toHaveLength(2)
    expect(record.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin'])
    expect(record.riders[0]?.theater.length).toBeGreaterThanOrEqual(3)
    expect(record.riders[0]?.finalFare).toBe(engine.riders[0]?.finalFare)
    expect(record.riders[1]?.finalFare).toBe(engine.riders[1]?.finalFare)
  })

  it('collecting 團 2 人再加入第 3 人且兩端有交集則 runMatch', async () => {
    const yu = await joinMatch(filePath, joinBody('A'))
    const lin = joinBody('B')
    writeFileSync(
      filePath,
      JSON.stringify({
        ...yu,
        riders: [
          yu.riders[0],
          {
            ...yu.riders[0],
            username: 'Lin',
            riderId: 'B',
            demand: lin.demand,
            routePage: lin.routePage,
          },
        ],
      }),
    )
    const record = await joinMatch(filePath, joinBody('C'))
    expect(record.riders).toHaveLength(3)
    expect(['settled', 'solo']).toContain(record.status)
    expect(record.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin', 'Chiang'])
    expect(record.riders[0]?.theater.length).toBeGreaterThanOrEqual(3)
  })

  it('圈不合回 409 walk_circles_miss，團檔不變', async () => {
    const first = await joinMatch(filePath, joinBody('A'))
    await expect(joinMatch(filePath, farJoin('B'))).rejects.toMatchObject({
      status: 409,
      error: 'walk_circles_miss',
    })
    expect(readMatch(filePath)).toEqual(first)
  })

  it('四人團已在檔內時，團員再 join 回原檔，不報 match_full', async () => {
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

  it('已 settled 再 join 開新團，只帶這一筆', async () => {
    await joinMatch(filePath, joinBody('A'))
    const settled = await joinMatch(filePath, joinBody('B'))
    expect(settled.status).toBe('settled')
    const next = await joinMatch(filePath, joinBody('C'))
    expect(next.status).toBe('collecting')
    expect(next.riders).toHaveLength(1)
    expect(next.riders[0]?.username).toBe('Chiang')
    expect(next.riders[0]?.routePage).toEqual(joinBody('C').routePage)
    expect(next.riders[0]?.theater).toEqual([])
  })

  it('四人依序 join 不會 match_full：第 2 人成交，之後開新團', async () => {
    const first = await joinMatch(filePath, joinBody('A'))
    expect(first.status).toBe('collecting')
    const second = await joinMatch(filePath, joinBody('B'))
    expect(second.status).toBe('settled')
    const third = await joinMatch(filePath, joinBody('C'))
    expect(third.status).toBe('collecting')
    expect(third.riders).toHaveLength(1)
    const fourth = await joinMatch(filePath, joinBody('D'))
    expect(fourth.status).toBe('settled')
    expect(fourth.riders).toHaveLength(2)
    expect(fourth.riders.map((rider) => rider.username)).toEqual(['Chiang', 'Yang'])
  })

  it('reset 刪團檔並回空 collecting', async () => {
    await joinMatch(filePath, joinBody('A'))
    expect(existsSync(filePath)).toBe(true)
    resetMatch(filePath)
    expect(existsSync(filePath)).toBe(false)
    expect(readMatch(filePath).status).toBe('collecting')
    expect(readMatch(filePath).riders).toEqual([])
  })

  it('有 key 時只覆寫 theater，成交欄位仍跟 runMatch', async () => {
    await joinMatch(filePath, joinBody('A'))
    const rewriteTheaters: TheaterRewriter = async (_apiKey, riders) =>
      riders.map((rider) => [
        `Rewritten line for ${rider.username}`,
        'Walls stay with the host.',
        'Your fare is NT$1.',
      ])
    const record = await joinMatch(filePath, joinBody('B'), {
      apiKey: 'test-key',
      rewriteTheaters,
    })
    const engine = runMatch([
      { username: 'Yu', demand: cloneRider('A'), routePage: pageFromDemand(cloneRider('A')) },
      { username: 'Lin', demand: cloneRider('B'), routePage: pageFromDemand(cloneRider('B')) },
    ])
    expect(record.status).toBe(engine.status)
    expect(record.adopted).toBe(engine.adopted)
    for (const [index, rider] of record.riders.entries()) {
      const raw = engine.riders[index]
      expect(rider.finalFare).toBe(raw?.finalFare)
      expect(rider.finalWalkMin).toBe(raw?.finalWalkMin)
      expect(rider.finalRideMin).toBe(raw?.finalRideMin)
      expect(rider.scoreV1).toBe(raw?.scoreV1)
      expect(rider.scoreV2).toBe(raw?.scoreV2)
      expect(rider.pitch).toEqual(raw?.pitch)
      expect(rider.kicked).toBe(raw?.kicked)
      expect(rider.theater[0]).toBe(`Rewritten line for ${rider.username}`)
      expect(rider.theater).not.toEqual(raw?.theater)
    }
  })

  it('無 key 時不呼叫潤稿', async () => {
    let called = false
    const rewriteTheaters: TheaterRewriter = async () => {
      called = true
      return []
    }
    await joinMatch(filePath, joinBody('A'), { rewriteTheaters })
    await joinMatch(filePath, joinBody('B'), { rewriteTheaters })
    expect(called).toBe(false)
  })
})
