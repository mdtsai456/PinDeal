import type { Username } from '../types.ts'
import { projectOntoSegment } from './corridor.ts'
import { holdRemainingMs } from './hold.ts'
import { majorityNeeded, USERNAME_TO_RIDER, type MatchRecord, type MatchRider, type SurplusAxis } from './match.ts'
import type { ShareRoutePlan } from './shareRoute.ts'

export const JUDGE_POLL_MS = 2000

export type JudgeLetter = 'A' | 'B' | 'C' | 'D'

export type JudgeDayBlock = {
  kind: 'day'
  text: string
}

export type JudgeSysBlock = {
  kind: 'sys'
  text: string
}

export type JudgeMindBlock = {
  kind: 'mind'
  title: string
  lines: string[]
}

export type JudgePitchBlock = {
  kind: 'pitch'
  letter: JudgeLetter
  label: string
  lines: string[]
}

export type JudgeScoreBlock = {
  kind: 'score'
  letter: JudgeLetter
  label: string
  lines: string[]
}

export type JudgeBlock = JudgeDayBlock | JudgeSysBlock | JudgeMindBlock | JudgePitchBlock | JudgeScoreBlock

// 把團檔譯成評審房間區塊。對白不是成交來源。
export function judgeThread(record: MatchRecord, nowMs = Date.now()): JudgeBlock[] {
  switch (record.status) {
    case 'collecting':
      return collectingThread(record, nowMs)
    case 'settled':
      return settledThread(record)
    case 'solo':
      return soloThread(record)
    default: {
      const _exhaustive: never = record.status
      return _exhaustive
    }
  }
}

function collectingThread(record: MatchRecord, nowMs: number): JudgeBlock[] {
  const letters = record.joins.map((join) => letterOf(join.username))
  const room = letters.length === 0 ? '' : ` In the room: ${agentList(letters)}.`
  const remaining = Math.ceil(holdRemainingMs(record.joins.length, record.lastJoinAt, nowMs) / 1000)
  return [
    { kind: 'day', text: `Today · waiting · ${countCopy(letters.length)}${letterTail(letters)}` },
    { kind: 'sys', text: `Waiting for nearby riders.${room} Hold ${remaining}s.` },
  ]
}

function settledThread(record: MatchRecord): JudgeBlock[] {
  const ordered = theaterRiderOrder(record)
  const shareLetters = boardLetters(record)
  const yes = record.riders.filter((rider) => rider.scoreV2 > rider.scoreV1).length
  const need = majorityNeeded(record.riders.length)
  const soloSum = record.riders.reduce((acc, rider) => acc + rider.v1.soloFare, 0)
  const meter = Math.round(0.72 * soloSum)
  const kicked = record.riders.filter((rider) => rider.kicked)
  return [
    {
      kind: 'day',
      text: `Today · ${countCopy(record.riders.length)} · doors spaced · ride slices overlap in part`,
    },
    { kind: 'sys', text: 'Structured packs arrived. Pickup circles meet. Dropoff circles meet.' },
    {
      kind: 'mind',
      title: 'Arbiter mind · v1',
      lines: [
        'Corridor first. Each agent snaps inside its own Max walk.',
        `Solo meter: ${ordered.map((rider) => `${rider.riderId} NT$${rider.v1.soloFare}`).join(' · ')}.`,
        `Shared meter = 0.72 × ${soloSum} = NT$${meter}. Split by solo ratio.`,
        'v1 on the table. Waiting for one surplus pitch each.',
      ],
    },
    ...ordered.map((rider) => pitchBlock(rider)),
    {
      kind: 'mind',
      title: 'Arbiter mind · v2',
      lines: [
        `${countWord(ordered.length)} pitches in. Move surplus on each axis, take each give.`,
        `${ordered.map((rider) => sliceDeltaCopy(rider)).filter((part) => part.length > 0).join('. ')}.`,
        `Last slice eats residual so the meter stays NT$${meter}.`,
        `Adopted fares: ${ordered.map((rider) => `${rider.riderId} NT$${rider.v2.fare}`).join(' · ')}.`,
      ],
    },
    ...ordered.map((rider) => scoreBlock(rider)),
    {
      kind: 'mind',
      title: 'Arbiter mind · close',
      lines: [
        `Yes votes ${yes} / ${record.riders.length}. Majority for ${record.riders.length} riders is ${need}. Adopt ${record.adopted}.`,
        `${kickCopy(kicked)} Board order ${shareLetters.map((letter, index) => `${letter} ${index + 1}`).join(' · ')}. Ride slices overlap only in part.`,
      ],
    },
  ]
}

function soloThread(record: MatchRecord): JudgeBlock[] {
  const ordered = [...record.riders].sort((left, right) => left.riderId.localeCompare(right.riderId))
  const letters = ordered.map((rider) => rider.riderId)
  return [
    { kind: 'day', text: `Today · share failed · ${countCopy(ordered.length)}${letterTail(letters)}` },
    { kind: 'sys', text: 'Shared taxi failed. Each rider takes a solo taxi.' },
    ...ordered.map((rider) => ({
      kind: 'score' as const,
      letter: rider.riderId,
      label: `Agent ${rider.riderId} · score`,
      lines: ['Share failed.', `Your fare is NT$${rider.finalFare}.`],
    })),
  ]
}

function pitchBlock(rider: MatchRider): JudgePitchBlock {
  return {
    kind: 'pitch',
    letter: rider.riderId,
    label: `Agent ${rider.riderId} · ${rider.demand.priority} → pitch`,
    lines: [
      `Push ${pushPhrase(rider.pitch.axis)}. Give ${givePhrase(rider.pitch.give)}.`,
      `Walk ${rider.v1.walkMin} min to the corridor.`,
    ],
  }
}

function scoreBlock(rider: MatchRider): JudgeScoreBlock {
  const vote =
    rider.scoreV2 > rider.scoreV1
      ? 'v2 scores higher than v1. Yes.'
      : rider.scoreV2 === rider.scoreV1
        ? 'v2 ties v1. Not a yes.'
        : 'v2 scores lower than v1. Not a yes.'
  return {
    kind: 'score',
    letter: rider.riderId,
    label: `Agent ${rider.riderId} · score`,
    lines: [vote, `Your fare is NT$${rider.finalFare}.`],
  }
}

function theaterRiderOrder(record: MatchRecord): MatchRider[] {
  const share = record.riders.filter((rider) => rider.outcome === 'share')
  const rest = record.riders.filter((rider) => rider.outcome !== 'share')
  return [...sortByBoard(share, record.sharePlan), ...sortByLetter(rest)]
}

function boardLetters(record: MatchRecord): JudgeLetter[] {
  return sortByBoard(
    record.riders.filter((rider) => rider.outcome === 'share'),
    record.sharePlan,
  ).map((rider) => rider.riderId)
}

function sortByBoard(riders: MatchRider[], plan: ShareRoutePlan | null): MatchRider[] {
  if (!plan) return sortByLetter(riders)
  return [...riders].sort((left, right) => {
    const leftT = projectOntoSegment(left.routePage.pickup, plan.spineA, plan.spineB).tLine
    const rightT = projectOntoSegment(right.routePage.pickup, plan.spineA, plan.spineB).tLine
    if (leftT !== rightT) return leftT - rightT
    return left.riderId.localeCompare(right.riderId)
  })
}

function sortByLetter(riders: MatchRider[]): MatchRider[] {
  return [...riders].sort((left, right) => left.riderId.localeCompare(right.riderId))
}

function sliceDeltaCopy(rider: MatchRider): string {
  const parts: string[] = []
  pushDelta(parts, 'walk', rider.v2.walkMin - rider.v1.walkMin)
  pushDelta(parts, 'ride', rider.v2.rideMin - rider.v1.rideMin)
  pushDelta(parts, 'fare', rider.v2.fare - rider.v1.fare)
  if (parts.length === 0) return ''
  return `${rider.riderId} ${parts.join(', ')}`
}

function pushDelta(parts: string[], axis: 'walk' | 'ride' | 'fare', delta: number): void {
  if (delta === 0) return
  parts.push(`${axis} ${signed(delta)}`)
}

function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : `\u2212${Math.abs(delta)}`
}

function kickCopy(kicked: MatchRider[]): string {
  if (kicked.length === 0) return 'No wall kick.'
  return `Wall kick: ${sortByLetter(kicked).map((rider) => `Agent ${rider.riderId}`).join(' · ')}.`
}

function letterOf(username: Username): JudgeLetter {
  return USERNAME_TO_RIDER[username]
}

function letterTail(letters: JudgeLetter[]): string {
  return letters.map((letter) => ` · Agent ${letter}`).join('')
}

function agentList(letters: JudgeLetter[]): string {
  return letters.map((letter) => `Agent ${letter}`).join(' · ')
}

function countCopy(n: number): string {
  return n === 1 ? '1 rider' : `${n} riders`
}

function countWord(n: number): string {
  switch (n) {
    case 1:
      return 'One'
    case 2:
      return 'Two'
    case 3:
      return 'Three'
    case 4:
      return 'Four'
    default:
      return String(n)
  }
}

function pushPhrase(axis: SurplusAxis): string {
  switch (axis) {
    case 'fare':
      return 'fare'
    case 'walk':
      return 'a shorter walk'
    case 'ride':
      return 'a shorter ride'
    case 'ontime':
      return 'on-time arrival'
    default: {
      const _exhaustive: never = axis
      return _exhaustive
    }
  }
}

function givePhrase(axis: SurplusAxis): string {
  switch (axis) {
    case 'fare':
      return 'fare'
    case 'walk':
      return 'walk'
    case 'ride':
      return 'ride'
    case 'ontime':
      return 'on-time arrival'
    default: {
      const _exhaustive: never = axis
      return _exhaustive
    }
  }
}
