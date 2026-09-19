import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { groupHasCommonIntersection } from '../src/engine/corridor.ts'
import {
  normalizeUsername,
  runMatch,
  USERNAME_TO_RIDER,
  USERNAMES,
  type MatchRecord,
  type MatchRider,
  type MatchSeed,
  type Username,
} from '../src/engine/match.ts'
import { parseDemand } from '../src/engine/parse.ts'
import { AGENT_SYSTEM_PROMPT, agentUserPromptV2 } from '../src/engine/prompts.ts'
import type { MatchJoinBody, RoutePageSnapshot } from '../src/engine/routePage.ts'
import { rewriteMatchTheaters, type TheaterRewriteInput } from './theaterLlm.ts'

export type TheaterRewriter = (
  apiKey: string,
  riders: TheaterRewriteInput[],
) => Promise<string[][]>

export type JoinMatchOptions = {
  apiKey?: string
  rewriteTheaters?: TheaterRewriter
}

export type JoinMatchErrorCode = 'walk_circles_miss' | 'match_full'

export class JoinMatchError extends Error {
  readonly status = 409 as const
  readonly error: JoinMatchErrorCode

  constructor(error: JoinMatchErrorCode) {
    super(error)
    this.name = 'JoinMatchError'
    this.error = error
  }
}

const BLANK_SLICE = {
  walkMin: 0,
  rideMin: 0,
  fare: 0,
  soloFare: 0,
  soloRideMin: 0,
  accessible: true,
  luggageOk: true,
} as const

export function isJoinMatchError(value: unknown): value is JoinMatchError {
  if (typeof value !== 'object' || value === null) return false
  if (!('status' in value) || value.status !== 409) return false
  if (!('error' in value)) return false
  return value.error === 'walk_circles_miss' || value.error === 'match_full'
}

export function emptyMatch(): MatchRecord {
  return {
    id: 'current',
    status: 'collecting',
    adopted: 'solo',
    riders: [],
  }
}

export function readMatch(filePath: string): MatchRecord {
  if (!existsSync(filePath)) return emptyMatch()
  return JSON.parse(readFileSync(filePath, 'utf8')) as MatchRecord
}

export function resetMatch(filePath: string): void {
  if (existsSync(filePath)) unlinkSync(filePath)
}

export async function joinMatch(
  filePath: string,
  body: MatchJoinBody,
  options: JoinMatchOptions = {},
): Promise<MatchRecord> {
  const incoming = asJoinBody(body)
  const current = readMatch(filePath)
  const alreadyIn = current.riders.some((rider) => rider.username === incoming.username)
  if (alreadyIn) {
    switch (current.status) {
      case 'settled':
      case 'solo':
        return current
      case 'collecting':
        return addToCollecting(filePath, current, incoming, options)
      default: {
        const _exhaustive: never = current.status
        return _exhaustive
      }
    }
  }
  if (current.riders.length >= 4) {
    throw new JoinMatchError('match_full')
  }

  switch (current.status) {
    case 'settled':
    case 'solo': {
      const record = collectingRecord([incoming])
      writeMatch(filePath, record)
      return record
    }
    case 'collecting':
      return addToCollecting(filePath, current, incoming, options)
    default: {
      const _exhaustive: never = current.status
      return _exhaustive
    }
  }
}

function addToCollecting(
  filePath: string,
  current: MatchRecord,
  incoming: MatchJoinBody,
  options: JoinMatchOptions,
): Promise<MatchRecord> {
  const kept = current.riders.filter((rider) => rider.username !== incoming.username)
  const pages = [...kept.map((rider) => rider.routePage), incoming.routePage]
  if (!bothEndsFit(pages)) {
    throw new JoinMatchError('walk_circles_miss')
  }

  const joins = [...kept.map(toJoinBody), incoming]
  if (joins.length === 1) {
    const record = collectingRecord(joins)
    writeMatch(filePath, record)
    return Promise.resolve(record)
  }

  return settle(filePath, joins, options)
}

async function settle(
  filePath: string,
  joins: MatchJoinBody[],
  options: JoinMatchOptions,
): Promise<MatchRecord> {
  const record = runMatch(joins.map(toSeed))
  const next = await applyTheaterRewrite(record, options)
  writeMatch(filePath, next)
  return next
}

async function applyTheaterRewrite(
  record: MatchRecord,
  options: JoinMatchOptions,
): Promise<MatchRecord> {
  const apiKey = options.apiKey ?? ''
  if (!apiKey) return record
  const rewrite = options.rewriteTheaters ?? rewriteMatchTheaters
  const inputs: TheaterRewriteInput[] = record.riders.map((rider) => ({
    username: rider.username,
    systemPrompt: AGENT_SYSTEM_PROMPT,
    userPrompt: agentUserPromptV2({
      walkMin: rider.v2.walkMin,
      rideMin: rider.v2.rideMin,
      fare: rider.v2.fare,
      pitch: JSON.stringify(rider.pitch),
      outcome: rider.outcome,
      finalWalkMin: rider.finalWalkMin,
      finalRideMin: rider.finalRideMin,
      finalFare: rider.finalFare,
    }),
    fallback: rider.theater,
  }))
  const theaters = await rewrite(apiKey, inputs)
  return {
    ...record,
    riders: record.riders.map((rider, index) => ({
      ...rider,
      theater: theaters[index] ?? rider.theater,
    })),
  }
}

function writeMatch(filePath: string, record: MatchRecord): void {
  // 團檔不可寫進 Vite public/。public/ 會被靜態送出。正式路徑是 repo 根目錄 storage/matches/。
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(record, null, 2))
}

function collectingRecord(joins: MatchJoinBody[]): MatchRecord {
  return {
    id: 'current',
    status: 'collecting',
    adopted: 'solo',
    riders: joins.map(toCollectingRider),
  }
}

function toCollectingRider(body: MatchJoinBody): MatchRider {
  return {
    username: body.username,
    riderId: USERNAME_TO_RIDER[body.username],
    routePage: body.routePage,
    demand: body.demand,
    structured: parseDemand(body.demand),
    v1: { ...BLANK_SLICE },
    v2: { ...BLANK_SLICE },
    scoreV1: 0,
    scoreV2: 0,
    pitch: { axis: 'fare', give: 'walk', note: '' },
    theater: [],
    kicked: false,
    outcome: 'solo',
    finalWalkMin: 0,
    finalRideMin: 0,
    finalFare: 0,
  }
}

function bothEndsFit(pages: RoutePageSnapshot[]): boolean {
  return (
    groupHasCommonIntersection(pages.map((page) => page.originCircle)) &&
    groupHasCommonIntersection(pages.map((page) => page.destCircle))
  )
}

function toJoinBody(rider: MatchRider): MatchJoinBody {
  return {
    username: rider.username,
    demand: rider.demand,
    routePage: rider.routePage,
  }
}

function toSeed(body: MatchJoinBody): MatchSeed {
  return {
    username: body.username,
    demand: body.demand,
    routePage: body.routePage,
  }
}

function asJoinBody(body: MatchJoinBody): MatchJoinBody {
  const username = asUsername(body.username)
  if (!username || !body.demand || !body.routePage) {
    throw new Error('bad_request')
  }
  return { username, demand: body.demand, routePage: body.routePage }
}

function asUsername(raw: string): Username | null {
  const username = normalizeUsername(raw)
  return USERNAMES.find((name) => name === username) ?? null
}
