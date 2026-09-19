import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cloneRider } from '../src/data.ts'
import { usernameForRider, runMatch, type MatchRecord } from '../src/engine/match.ts'
import { isMatchReady } from '../src/engine/matchView.ts'
import { snapshotRoutePage, type MatchJoinBody } from '../src/engine/routePage.ts'
import { placeById } from '../src/geo.ts'
import type { RiderDemand, RiderId } from '../src/types.ts'
import { flushHold, joinMatch, readMatch, resetMatch, type TheaterRewriter } from './matchStore.ts'

const REAL_MATCH_FILE = `${path.sep}storage${path.sep}matches${path.sep}current.json`
const T0 = Date.parse('2026-09-20T00:00:00.000Z')

function isoAt(ms: number): string {
  return new Date(ms).toISOString()
}

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
      pickup: { id: 'far-p', name: 'Far pickup', address: '', lat: 25.0478, lng: 121.517 },
      dropoff: { id: 'far-d', name: 'Far dest', address: '', lat: 25.0674, lng: 121.6147 },
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
      joins: [],
      riders: [],
      sharePlan: null,
      lastJoinAt: null,
    })
    expect(existsSync(filePath)).toBe(false)
    expect(filePath.includes(REAL_MATCH_FILE)).toBe(false)
    expect(path.basename(dir).startsWith('sharemeter-match-')).toBe(true)
  })

  it('1 人 join 是 collecting，只存 joins，不寫空白 rider', async () => {
    const body = joinBody('A')
    const record = await joinMatch(filePath, body, { nowMs: T0 })
    expect(record.status).toBe('collecting')
    expect(record.adopted).toBe('solo')
    expect(record.riders).toEqual([])
    expect(record.sharePlan).toBeNull()
    expect(record.lastJoinAt).toBe(isoAt(T0))
    expect(record.joins).toEqual([body])
    const saved = JSON.parse(readFileSync(filePath, 'utf8')) as MatchRecord
    expect(saved.riders).toEqual([])
    expect(saved.joins).toHaveLength(1)
    expect(JSON.stringify(saved)).not.toContain('"finalFare": 0')
    expect(JSON.stringify(saved)).not.toContain('"scoreV1": 0')
    expect(saved.joins[0]?.routePage.notes).toBe(body.routePage.notes)
    expect(saved.joins[0]?.routePage.originCircle).toEqual(body.routePage.originCircle)
  })

  it('舊 collecting 空白 riders 讀檔時升成 joins 並丟掉 riders', () => {
    writeFileSync(
      filePath,
      JSON.stringify({
        id: 'current',
        status: 'collecting',
        adopted: 'solo',
        riders: [
          {
            username: 'Yu',
            riderId: 'A',
            demand: cloneRider('A'),
            routePage: pageFromDemand(cloneRider('A')),
            v1: { walkMin: 0, rideMin: 0, fare: 0, soloFare: 0, soloRideMin: 0, accessible: true, luggageOk: true },
            finalFare: 0,
          },
        ],
      }),
    )
    const record = readMatch(filePath)
    expect(record.status).toBe('collecting')
    expect(record.joins).toHaveLength(1)
    expect(record.joins[0]?.username).toBe('Yu')
    expect(record.joins[0]?.routePage.originCircle).toEqual(pageFromDemand(cloneRider('A')).originCircle)
    expect(record.riders).toEqual([])
    expect(record.sharePlan).toBeNull()
    expect(record.lastJoinAt).toEqual(expect.any(String))
    expect(Number.isNaN(Date.parse(record.lastJoinAt!))).toBe(false)
  })

  it('2 人兩端圈有交集仍 collecting，lastJoinAt 為第 2 人時間', async () => {
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    const record = await joinMatch(filePath, joinBody('B'), { nowMs: T0 + 1000 })
    expect(record.status).toBe('collecting')
    expect(record.riders).toEqual([])
    expect(record.joins).toHaveLength(2)
    expect(record.joins.map((join) => join.username)).toEqual(['Yu', 'Lin'])
    expect(record.lastJoinAt).toBe(isoAt(T0 + 1000))
  })

  it('collecting 團 2 人再加入第 3 人仍 collecting', async () => {
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    await joinMatch(filePath, joinBody('B'), { nowMs: T0 + 1000 })
    const record = await joinMatch(filePath, joinBody('C'), { nowMs: T0 + 2000 })
    expect(record.status).toBe('collecting')
    expect(record.riders).toEqual([])
    expect(record.joins).toHaveLength(3)
    expect(record.joins.map((join) => join.username)).toEqual(['Yu', 'Lin', 'Chiang'])
    expect(record.lastJoinAt).toBe(isoAt(T0 + 2000))
  })

  it('同帳號再 join 更新內容但不重設 lastJoinAt', async () => {
    const first = await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    const again = joinBody('A')
    again.routePage = { ...again.routePage, notes: 'updated notes' }
    const record = await joinMatch(filePath, again, { nowMs: T0 + 4000 })
    expect(record.status).toBe('collecting')
    expect(record.joins).toHaveLength(1)
    expect(record.joins[0]?.routePage.notes).toBe('updated notes')
    expect(record.lastJoinAt).toBe(first.lastJoinAt)
    expect(record.lastJoinAt).toBe(isoAt(T0))
  })

  it('圈不合回 409 walk_circles_miss，團檔不變', async () => {
    const first = await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    await expect(joinMatch(filePath, farJoin('B'), { nowMs: T0 + 4000 })).rejects.toMatchObject({
      status: 409,
      error: 'walk_circles_miss',
    })
    expect(readMatch(filePath)).toEqual(first)
    expect(readMatch(filePath).lastJoinAt).toBe(isoAt(T0))
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
    const settled = runMatch([
      { username: 'Yu', demand: cloneRider('A'), routePage: pageFromDemand(cloneRider('A')) },
      { username: 'Lin', demand: cloneRider('B'), routePage: pageFromDemand(cloneRider('B')) },
    ])
    writeFileSync(filePath, JSON.stringify(settled))
    expect(readMatch(filePath).status).toBe('settled')
    const next = await joinMatch(filePath, joinBody('C'), { nowMs: T0 })
    expect(next.status).toBe('collecting')
    expect(next.riders).toEqual([])
    expect(next.joins).toHaveLength(1)
    expect(next.joins[0]?.username).toBe('Chiang')
    expect(next.joins[0]?.routePage).toEqual(joinBody('C').routePage)
    expect(next.lastJoinAt).toBe(isoAt(T0))
  })

  it('四人在同一 idle 內依序 join：第 1–3 人 collecting，第 4 人成交', async () => {
    const first = await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    expect(first.status).toBe('collecting')
    const second = await joinMatch(filePath, joinBody('B'), { nowMs: T0 + 1000 })
    expect(second.status).toBe('collecting')
    expect(second.riders).toEqual([])
    const third = await joinMatch(filePath, joinBody('C'), { nowMs: T0 + 2000 })
    expect(third.status).toBe('collecting')
    expect(third.joins).toHaveLength(3)
    expect(third.riders).toEqual([])
    const engine = runMatch(
      (['A', 'B', 'C', 'D'] as const).map((id) => ({
        username: usernameForRider(id),
        demand: cloneRider(id),
        routePage: pageFromDemand(cloneRider(id)),
      })),
    )
    const fourth = await joinMatch(filePath, joinBody('D'), { nowMs: T0 + 3000 })
    expect(fourth.status).toBe(engine.status)
    expect(['settled', 'solo']).toContain(fourth.status)
    expect(fourth.riders).toHaveLength(4)
    expect(fourth.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin', 'Chiang', 'Yang'])
    expect(fourth.lastJoinAt).toBeNull()
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
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    await joinMatch(filePath, joinBody('B'), { nowMs: T0 + 1000 })
    await joinMatch(filePath, joinBody('C'), { nowMs: T0 + 2000 })
    const engine = runMatch(
      (['A', 'B', 'C', 'D'] as const).map((id) => ({
        username: usernameForRider(id),
        demand: cloneRider(id),
        routePage: pageFromDemand(cloneRider(id)),
      })),
    )
    const rewriteTheaters: TheaterRewriter = async (_apiKey, riders) => {
      expect(riders[0]?.userPrompt).toContain(`fare=${engine.riders[0]?.finalFare}`)
      expect(riders[0]?.userPrompt).toContain('Rewrite theater from the adopted offer')
      expect(riders[0]?.userPrompt).not.toContain('Score offer v2')
      return riders.map((rider) => [
        `Rewritten line for ${rider.username}`,
        'Walls stay with the host.',
        'Your fare is NT$1.',
      ])
    }
    const record = await joinMatch(filePath, joinBody('D'), {
      apiKey: 'test-key',
      rewriteTheaters,
      nowMs: T0 + 3000,
    })
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
    await joinMatch(filePath, joinBody('A'), { rewriteTheaters, nowMs: T0 })
    await joinMatch(filePath, joinBody('B'), { rewriteTheaters, nowMs: T0 + 1000 })
    await joinMatch(filePath, joinBody('C'), { rewriteTheaters, nowMs: T0 + 2000 })
    await joinMatch(filePath, joinBody('D'), { rewriteTheaters, nowMs: T0 + 3000 })
    expect(called).toBe(false)
  })

  it('t=0 join Yu，t=14999 flush 仍 collecting', async () => {
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    const record = await flushHold(filePath, { nowMs: T0 + 14_999 })
    expect(record.status).toBe('collecting')
    expect(record.joins).toHaveLength(1)
    expect(record.riders).toEqual([])
    expect(record.lastJoinAt).toBe(isoAt(T0))
  })

  it('t=0 join Yu，t=15000 flush 成一人 solo，可進 Pay', async () => {
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    const solo = runMatch([
      { username: 'Yu', demand: cloneRider('A'), routePage: pageFromDemand(cloneRider('A')) },
    ])
    const record = await flushHold(filePath, { nowMs: T0 + 15_000 })
    expect(record.status).toBe('solo')
    expect(record.riders).toHaveLength(1)
    expect(record.riders[0]?.username).toBe('Yu')
    expect(record.riders[0]?.finalFare).toBe(solo.riders[0]?.finalFare)
    expect(record.lastJoinAt).toBeNull()
    expect(isMatchReady(record, 'Yu')).toBe(true)
  })

  it('Yu 後 Lin 在 t=1000，t=16000 flush 對兩人 runMatch', async () => {
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    await joinMatch(filePath, joinBody('B'), { nowMs: T0 + 1000 })
    const engine = runMatch([
      { username: 'Yu', demand: cloneRider('A'), routePage: pageFromDemand(cloneRider('A')) },
      { username: 'Lin', demand: cloneRider('B'), routePage: pageFromDemand(cloneRider('B')) },
    ])
    const stillOpen = await flushHold(filePath, { nowMs: T0 + 1000 + 14_999 })
    expect(stillOpen.status).toBe('collecting')
    const record = await flushHold(filePath, { nowMs: T0 + 16_000 })
    expect(record.status).toBe(engine.status)
    expect(['settled', 'solo']).toContain(record.status)
    expect(record.riders).toHaveLength(2)
    expect(record.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin'])
    expect(record.riders[0]?.finalFare).toBe(engine.riders[0]?.finalFare)
  })

  it('圈不合不重設時鐘，t=15000 flush 仍只結 Yu', async () => {
    const first = await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    await expect(joinMatch(filePath, farJoin('B'), { nowMs: T0 + 4000 })).rejects.toMatchObject({
      error: 'walk_circles_miss',
    })
    expect(readMatch(filePath).lastJoinAt).toBe(first.lastJoinAt)
    const record = await flushHold(filePath, { nowMs: T0 + 15_000 })
    expect(record.status).toBe('solo')
    expect(record.riders).toHaveLength(1)
    expect(record.riders[0]?.username).toBe('Yu')
  })

  it('兩人 idle 到期後第 3 人開新團', async () => {
    await joinMatch(filePath, joinBody('A'), { nowMs: T0 })
    await joinMatch(filePath, joinBody('B'), { nowMs: T0 + 1000 })
    const chiang = await joinMatch(filePath, joinBody('C'), { nowMs: T0 + 20_000 })
    expect(chiang.status).toBe('collecting')
    expect(chiang.joins).toHaveLength(1)
    expect(chiang.joins[0]?.username).toBe('Chiang')
    expect(chiang.riders).toEqual([])
    expect(readMatch(filePath).joins.map((join) => join.username)).toEqual(['Chiang'])
  })

  it('4 人 collecting 舊檔 flush 先成交', async () => {
    const joins = (['A', 'B', 'C', 'D'] as const).map((id) => joinBody(id))
    writeFileSync(
      filePath,
      JSON.stringify({
        id: 'current',
        status: 'collecting',
        adopted: 'solo',
        joins,
        riders: [],
        sharePlan: null,
        lastJoinAt: isoAt(T0),
      }),
    )
    const record = await flushHold(filePath, { nowMs: T0 })
    expect(['settled', 'solo']).toContain(record.status)
    expect(record.riders).toHaveLength(4)
    expect(record.riders.map((rider) => rider.username)).toEqual(['Yu', 'Lin', 'Chiang', 'Yang'])
    expect(readMatch(filePath).status).toBe(record.status)
  })
})
