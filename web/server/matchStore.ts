import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  normalizeUsername,
  runMatch,
  USERNAME_TO_RIDER,
  USERNAMES,
  type MatchRecord,
  type MatchSeed,
  type Username,
} from '../src/engine/match.ts'
import { holdExpired } from '../src/engine/hold.ts'
import { AGENT_SYSTEM_PROMPT, agentUserPromptAdopted } from '../src/engine/prompts.ts'
import type { MatchJoinBody } from '../src/engine/routePage.ts'
import { planShareRoute } from '../src/engine/shareRoute.ts'
import { rememberPlace } from '../src/geo.ts'
import { rewriteMatchTheaters, type TheaterRewriteInput } from './theaterLlm.ts'

export type TheaterRewriter = (
  apiKey: string,
  riders: TheaterRewriteInput[],
) => Promise<string[][]>

export type JoinMatchOptions = {
  apiKey?: string
  rewriteTheaters?: TheaterRewriter
  nowMs?: number
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
    joins: [],
    riders: [],
    sharePlan: null,
    lastJoinAt: null,
  }
}

export function readMatch(filePath: string): MatchRecord {
  if (!existsSync(filePath)) return emptyMatch()
  return migrateMatch(JSON.parse(readFileSync(filePath, 'utf8')) as MatchRecord)
}

// 舊 collecting 檔把空白 riders 升成 joins。升完後丟掉 riders。
function migrateMatch(raw: MatchRecord): MatchRecord {
  const riders = raw.riders ?? []
  const joins = raw.joins ?? []
  if (raw.status === 'collecting') {
    const lifted = joins.length > 0 ? joins : riders.map(toJoinBody)
    const lastJoinAt =
      raw.lastJoinAt ?? (lifted.length > 0 ? new Date().toISOString() : null)
    return {
      ...raw,
      joins: lifted,
      riders: [],
      sharePlan: null,
      lastJoinAt,
    }
  }
  return {
    ...raw,
    joins: joins.length > 0 ? joins : riders.map(toJoinBody),
    riders,
    sharePlan: raw.sharePlan ?? null,
    lastJoinAt: raw.lastJoinAt ?? null,
  }
}

export function resetMatch(filePath: string): void {
  if (existsSync(filePath)) unlinkSync(filePath)
}

export async function flushHold(
  filePath: string,
  options: JoinMatchOptions = {},
): Promise<MatchRecord> {
  const current = readMatch(filePath)
  if (current.status !== 'collecting' || current.joins.length === 0) return current
  if (!holdExpired(current.joins.length, current.lastJoinAt, nowOf(options))) return current
  return settle(filePath, current.joins, options)
}

export async function joinMatch(
  filePath: string,
  body: MatchJoinBody,
  options: JoinMatchOptions = {},
): Promise<MatchRecord> {
  const incoming = asJoinBody(body)
  const current = await flushHold(filePath, options)
  const alreadyIn = memberNames(current).includes(incoming.username)
  if (alreadyIn && current.status === 'collecting') {
    return addToCollecting(filePath, current, incoming, options)
  }
  if (!alreadyIn && memberCount(current) >= 4) {
    throw new JoinMatchError('match_full')
  }

  switch (current.status) {
    case 'settled':
    case 'solo': {
      const record = collectingRecord([incoming], new Date(nowOf(options)).toISOString())
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
  const alreadyIn = current.joins.some((join) => join.username === incoming.username)
  const kept = current.joins.filter((join) => join.username !== incoming.username)
  const joins = [...kept, incoming]
  if (!alreadyIn && joins.length > 1 && planShareRoute(joins.map(toShareInput)) == null) {
    throw new JoinMatchError('walk_circles_miss')
  }
  if (alreadyIn) {
    const record = collectingRecord(joins, current.lastJoinAt)
    writeMatch(filePath, record)
    return Promise.resolve(record)
  }
  if (joins.length < 4) {
    const record = collectingRecord(joins, new Date(nowOf(options)).toISOString())
    writeMatch(filePath, record)
    return Promise.resolve(record)
  }
  return settle(filePath, joins, options)
}

function nowOf(options: JoinMatchOptions): number {
  return options.nowMs ?? Date.now()
}

async function settle(
  filePath: string,
  joins: MatchJoinBody[],
  options: JoinMatchOptions,
): Promise<MatchRecord> {
  rememberJoinPlaces(joins)
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
    userPrompt: agentUserPromptAdopted({
      walkMin: rider.finalWalkMin,
      rideMin: rider.finalRideMin,
      fare: rider.finalFare,
      pitch: JSON.stringify(rider.pitch),
      outcome: rider.outcome,
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

function collectingRecord(joins: MatchJoinBody[], lastJoinAt: string | null): MatchRecord {
  return {
    id: 'current',
    status: 'collecting',
    adopted: 'solo',
    joins,
    riders: [],
    sharePlan: null,
    lastJoinAt,
  }
}

function memberNames(record: MatchRecord): Username[] {
  switch (record.status) {
    case 'collecting':
      return record.joins.map((join) => join.username)
    case 'settled':
    case 'solo':
      return record.riders.map((rider) => rider.username)
    default: {
      const _exhaustive: never = record.status
      return _exhaustive
    }
  }
}

function memberCount(record: MatchRecord): number {
  switch (record.status) {
    case 'collecting':
      return record.joins.length
    case 'settled':
    case 'solo':
      return record.riders.length
    default: {
      const _exhaustive: never = record.status
      return _exhaustive
    }
  }
}

function rememberJoinPlaces(joins: MatchJoinBody[]): void {
  for (const join of joins) {
    rememberPlace(join.routePage.pickup)
    rememberPlace(join.routePage.dropoff)
  }
}

function toShareInput(body: MatchJoinBody) {
  return {
    riderId: USERNAME_TO_RIDER[body.username],
    pickup: body.routePage.pickup,
    dropoff: body.routePage.dropoff,
    originCircle: body.routePage.originCircle,
    destCircle: body.routePage.destCircle,
    maxWalkMin: body.routePage.maxWalkMin,
  }
}

function toJoinBody(rider: Pick<MatchJoinBody, 'username' | 'demand' | 'routePage'>): MatchJoinBody {
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
