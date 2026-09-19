import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import { placeById } from '../geo'
import { projectOntoSegment } from './corridor'
import { MATCH_POLL_MS } from './matchApi'
import {
  majorityNeeded,
  runMatch,
  USERNAME_TO_RIDER,
  usernameForRider,
  type MatchRecord,
  type MatchSeed,
} from './match'
import { snapshotRoutePage } from './routePage'
import { JUDGE_POLL_MS, judgeThread, type JudgeBlock } from './judgeTheater'

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

function collectingOf(...ids: Array<'A' | 'B' | 'C' | 'D'>): MatchRecord {
  const seeds = ids.map((id) => seedFrom(id))
  return {
    id: 'current',
    status: 'collecting',
    adopted: 'solo',
    joins: seeds.map((seed) => ({
      username: seed.username,
      demand: seed.demand,
      routePage: seed.routePage,
    })),
    riders: [],
    sharePlan: null,
    lastJoinAt: null,
  }
}

function flatten(blocks: JudgeBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case 'day':
        case 'sys':
          return block.text
        case 'mind':
          return `${block.title} ${block.lines.join(' ')}`
        case 'pitch':
        case 'score':
          return `${block.letter} ${block.label} ${block.lines.join(' ')}`
        default: {
          const _exhaustive: never = block
          return _exhaustive
        }
      }
    })
    .join('\n')
}

function boardLetters(record: MatchRecord): Array<'A' | 'B' | 'C' | 'D'> {
  const plan = record.sharePlan
  if (!plan) return []
  const share = record.riders.filter((rider) => rider.outcome === 'share')
  return [...share]
    .sort((left, right) => {
      const leftT = projectOntoSegment(left.routePage.pickup, plan.spineA, plan.spineB).tLine
      const rightT = projectOntoSegment(right.routePage.pickup, plan.spineA, plan.spineB).tLine
      if (leftT !== rightT) return leftT - rightT
      return left.riderId.localeCompare(right.riderId)
    })
    .map((rider) => rider.riderId)
}

describe('JUDGE_POLL_MS', () => {
  it('評審 2000ms，不改乘客 800ms', () => {
    expect(JUDGE_POLL_MS).toBe(2000)
    expect(MATCH_POLL_MS).toBe(800)
    expect(JUDGE_POLL_MS).not.toBe(MATCH_POLL_MS)
  })
})

describe('judgeThread collecting', () => {
  it('riders 為空時，用 joins 字母等待，不上 username', () => {
    const record = collectingOf('A')
    expect(record.riders).toEqual([])
    const blocks = judgeThread(record)
    const blob = flatten(blocks)
    expect(blob).toMatch(/waiting/i)
    expect(blob).toMatch(/Agent A/)
    expect(blob).not.toMatch(/Yu|Chiang|Lin|Yang/)
    expect(blocks.some((block) => block.kind === 'pitch' || block.kind === 'score')).toBe(false)
  })

  it('Chiang join 只寫 Agent C', () => {
    const blob = flatten(judgeThread(collectingOf('C')))
    expect(blob).toMatch(/Agent C/)
    expect(blob).not.toMatch(/Agent A/)
    expect(blob).not.toMatch(/Chiang/)
  })

  it('空團仍顯示等待', () => {
    const blob = flatten(judgeThread(collectingOf()))
    expect(blob).toMatch(/waiting/i)
    expect(blob).not.toMatch(/Agent [ABCD]/)
    expect(blob).not.toMatch(/Yu|Chiang|Lin|Yang/)
  })

  it('sys 行在房名單後加剩餘秒', () => {
    const lastJoinAt = '2026-09-20T00:00:00.000Z'
    const nowMs = Date.parse(lastJoinAt) + 3_000
    const record = { ...collectingOf('A', 'B'), lastJoinAt }
    const sys = judgeThread(record, nowMs).find((block) => block.kind === 'sys')
    expect(sys?.kind).toBe('sys')
    expect(sys && sys.kind === 'sys' ? sys.text : '').toBe(
      'Waiting for nearby riders. In the room: Agent A · Agent B. Hold 12s.',
    )
  })
})

describe('judgeThread settled', () => {
  it('2 人順序為 sys → v1 → pitch → v2 → score → close', () => {
    const record = runMatch([seedFrom('A'), seedFrom('B')])
    expect(record.status).toBe('settled')
    const kinds = judgeThread(record).map((block) => block.kind)
    expect(kinds).toEqual(['day', 'sys', 'mind', 'pitch', 'pitch', 'mind', 'score', 'score', 'mind'])
    const minds = judgeThread(record).filter((block) => block.kind === 'mind')
    expect(minds[0]?.title).toMatch(/v1/)
    expect(minds[1]?.title).toMatch(/v2/)
    expect(minds[2]?.title).toMatch(/close/)
  })

  it('settled 氣泡不含 username', () => {
    const record = runMatch([seedFrom('A'), seedFrom('B')])
    expect(flatten(judgeThread(record))).not.toMatch(/Yu|Chiang|Lin|Yang/)
  })

  it('v1 寫獨乘跳表與 0.72 總額', () => {
    const record = runMatch([seedFrom('A'), seedFrom('B')])
    const v1 = judgeThread(record).find((block) => block.kind === 'mind' && block.title.includes('v1'))
    const text = v1 && v1.kind === 'mind' ? v1.lines.join(' ') : ''
    expect(text).toMatch(/0\.72/)
    for (const rider of record.riders) {
      expect(text).toContain(`NT$${rider.v1.soloFare}`)
    }
    const soloSum = record.riders.reduce((acc, rider) => acc + rider.v1.soloFare, 0)
    expect(text).toContain(`NT$${Math.round(0.72 * soloSum)}`)
  })

  it('score 含自己的 finalFare，Yes 僅當 scoreV2 > scoreV1', () => {
    const record = runMatch([seedFrom('A'), seedFrom('B')])
    const scores = judgeThread(record).filter((block) => block.kind === 'score')
    expect(scores).toHaveLength(2)
    for (const rider of record.riders) {
      const block = scores.find((item) => item.kind === 'score' && item.letter === rider.riderId)
      expect(block).toBeDefined()
      const text = block && block.kind === 'score' ? block.lines.join(' ') : ''
      expect(text).toContain(`NT$${rider.finalFare}`)
      if (rider.scoreV2 > rider.scoreV1) {
        expect(text).toMatch(/Yes/)
        expect(text).not.toMatch(/Not a yes/)
      } else {
        expect(text).toMatch(/Not a yes/)
      }
    }
  })

  it('close 寫票數、majorityNeeded、adopt，上車序依走廊投影', () => {
    const record = runMatch([seedFrom('B'), seedFrom('A')])
    expect(record.status).toBe('settled')
    const blocks = judgeThread(record)
    const close = blocks.filter((block) => block.kind === 'mind').at(-1)
    const closeText = close && close.kind === 'mind' ? close.lines.join(' ') : ''
    const yes = record.riders.filter((rider) => rider.scoreV2 > rider.scoreV1).length
    const need = majorityNeeded(record.riders.length)
    expect(closeText).toContain(`Yes votes ${yes} / ${record.riders.length}`)
    expect(closeText).toContain(`Majority for ${record.riders.length} riders is ${need}`)
    expect(closeText).toMatch(new RegExp(`Adopt ${record.adopted}`))
    expect(closeText).toMatch(/No wall kick/)

    const expected = boardLetters(record)
    const joinLetters = record.joins.map((join) => USERNAME_TO_RIDER[join.username])
    const pitches = blocks.filter((block) => block.kind === 'pitch').map((block) => {
      return block.kind === 'pitch' ? block.letter : '?'
    })
    expect(pitches).toEqual(expected)
    expect(closeText).toContain(`Board order ${expected.map((letter, index) => `${letter} ${index + 1}`).join(' · ')}`)
    expect(expected).not.toEqual(joinLetters)
  })

  it('牆踢寫 Agent 字母，多數文案用原團人數', () => {
    const record = runMatch([
      seedFrom('A', { maxDetourMin: 5, priority: 'time' }),
      seedFrom('B', { maxWalkMin: 1, maxDetourMin: 18, priority: 'price' }),
      seedFrom('C', { maxWalkMin: 6, maxDetourMin: 15, priority: 'comfort' }),
    ])
    expect(record.status).toBe('settled')
    expect(record.adopted).toBe('v2')
    const kicked = record.riders.filter((rider) => rider.kicked)
    expect(kicked.map((rider) => rider.riderId)).toEqual(['B'])
    const blob = flatten(judgeThread(record))
    expect(blob).not.toMatch(/Yu|Chiang|Lin|Yang/)
    const close = judgeThread(record).filter((block) => block.kind === 'mind').at(-1)
    const closeText = close && close.kind === 'mind' ? close.lines.join(' ') : ''
    expect(closeText).toMatch(/Wall kick/)
    expect(closeText).toMatch(/Agent B/)
    expect(closeText).toContain(`Majority for ${record.riders.length} riders is ${majorityNeeded(record.riders.length)}`)
    expect(closeText).toMatch(/Adopt v2/)
    const shareLetters = boardLetters(record)
    expect(closeText).toContain(`Board order ${shareLetters.map((letter, index) => `${letter} ${index + 1}`).join(' · ')}`)
  })
})

describe('judgeThread solo', () => {
  it('走廊無計畫時說明共乘失敗，並寫每人獨乘車資', () => {
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
    expect(record.status).toBe('solo')
    const blocks = judgeThread(record)
    const blob = flatten(blocks)
    expect(blob).toMatch(/fail/i)
    expect(blob).toMatch(/solo/i)
    expect(blob).not.toMatch(/Yu|Chiang|Lin|Yang/)
    expect(blocks.some((block) => block.kind === 'pitch')).toBe(false)
    for (const rider of record.riders) {
      expect(blob).toContain(`NT$${rider.finalFare}`)
      expect(blob).toMatch(new RegExp(`Agent ${rider.riderId}`))
    }
  })
})
