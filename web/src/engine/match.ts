import { placeById } from '../geo.ts'
import type { RiderDemand, RiderId, StructuredDemand, Username } from '../types.ts'
import { haversineKm } from './corridor.ts'
import { parseDemand } from './parse.ts'
import { snapshotRoutePage, type RoutePageSnapshot } from './routePage.ts'
import { delaySecFromTrip, hsinchuMeter } from './taxiTariff.ts'
import { buildTheater } from './theater.ts'

export type { Username }

export type SurplusAxis = 'fare' | 'walk' | 'ride' | 'ontime'

export type OfferSlice = {
  walkMin: number
  rideMin: number
  fare: number
  soloFare: number
  soloRideMin: number
  accessible: boolean
  luggageOk: boolean
}

export type Pitch = {
  axis: SurplusAxis
  give: SurplusAxis
  note: string
}

export type MatchStatus = 'collecting' | 'settled' | 'solo'

export type MatchRider = {
  username: Username
  riderId: RiderId
  routePage: RoutePageSnapshot
  demand: RiderDemand
  structured: StructuredDemand
  v1: OfferSlice
  v2: OfferSlice
  scoreV1: number
  scoreV2: number
  pitch: Pitch
  // 此欄只給該名乘客讀。其他乘客的畫面不得讀。
  theater: string[]
  kicked: boolean
  outcome: 'share' | 'solo'
  finalWalkMin: number
  finalRideMin: number
  finalFare: number
}

export type MatchRecord = {
  id: string
  status: MatchStatus
  adopted: 'v1' | 'v2' | 'solo'
  riders: MatchRider[]
}

export type MatchSeed = {
  username: Username
  demand: RiderDemand
  routePage?: RoutePageSnapshot
}

export type WallInput = {
  maxWalkMin: number
  maxDetourMin: number
  accessibility: boolean
  luggageCount: number
}

export const USERNAMES: Username[] = ['Yu', 'Chiang', 'Lin', 'Yang']

export const USERNAME_TO_RIDER: Record<Username, RiderId> = {
  Yu: 'A',
  Lin: 'B',
  Chiang: 'C',
  Yang: 'D',
}

const FARE_NUDGE = 8
const WALK_GIVE_MIN = 2
const SHARE_METER_RATIO = 0.72
const V1_WALK_CAP = 4
const V1_RIDE_EXTRA_CAP = 4

export function normalizeUsername(raw: string): string {
  const trimmed = raw.trim()
  const hit = USERNAMES.find((name) => name.toLowerCase() === trimmed.toLowerCase())
  return hit ?? trimmed
}

export function usernameForRider(id: RiderId): Username {
  switch (id) {
    case 'A':
      return 'Yu'
    case 'B':
      return 'Lin'
    case 'C':
      return 'Chiang'
    case 'D':
      return 'Yang'
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

// 牆：walkMin > maxWalkMin。rideMin > soloRideMin + maxDetourMin。需要 accessibility 但 accessible 為 false。luggageCount >= 2 但 luggageOk 為 false。fare >= soloFare。任一成立即踢出。
export function hitsWall(offer: OfferSlice, walls: WallInput): boolean {
  if (offer.walkMin > walls.maxWalkMin) return true
  if (offer.rideMin > offer.soloRideMin + walls.maxDetourMin) return true
  if (offer.fare >= offer.soloFare) return true
  if (walls.accessibility && !offer.accessible) return true
  if (walls.luggageCount >= 2 && !offer.luggageOk) return true
  return false
}

export function scoreOffer(offer: OfferSlice, walls: WallInput): number {
  if (hitsWall(offer, walls)) return 0
  const money = unitRatio(offer.soloFare - offer.fare, offer.soloFare)
  const timeSlack = unitRatio(
    offer.soloRideMin + walls.maxDetourMin - offer.rideMin,
    walls.maxDetourMin,
  )
  const walkSlack = unitRatio(walls.maxWalkMin - offer.walkMin, walls.maxWalkMin)
  return (money + timeSlack + walkSlack) / 3
}

export function majorityNeeded(riderCount: number): number {
  if (riderCount <= 1) return riderCount
  if (riderCount === 2) return 2
  if (riderCount === 3) return 2
  return 3
}

export function adoptVersion(scoreV1: number[], scoreV2: number[]): 'v1' | 'v2' {
  const yes = scoreV2.filter((value, index) => value > (scoreV1[index] ?? 0)).length
  return yes >= majorityNeeded(scoreV1.length) ? 'v2' : 'v1'
}

export function splitBySolo(soloFares: number[], totalMeter: number): number[] {
  if (soloFares.length === 0) return []
  const sum = soloFares.reduce((acc, fare) => acc + fare, 0)
  if (sum <= 0) {
    const even = Math.floor(totalMeter / soloFares.length)
    const fares = soloFares.map(() => even)
    fares[fares.length - 1] = totalMeter - even * (soloFares.length - 1)
    return fares
  }
  const fares = soloFares.map((solo, index) =>
    index === soloFares.length - 1 ? 0 : Math.round((totalMeter * solo) / sum),
  )
  const head = fares.slice(0, -1).reduce((acc, fare) => acc + fare, 0)
  fares[fares.length - 1] = totalMeter - head
  return fares
}

export function pitchFromDemand(demand: RiderDemand): Pitch {
  const priority = parseDemand(demand).priority
  switch (priority) {
    case 'time':
      return { axis: 'ontime', give: 'fare', note: 'Keep this rider on time. Fare can move.' }
    case 'price':
      return { axis: 'fare', give: 'walk', note: 'Push fare down. Walk can increase.' }
    case 'comfort':
      return { axis: 'walk', give: 'fare', note: 'Keep the walk short. Fare can move.' }
    case 'direct':
      return { axis: 'ride', give: 'fare', note: 'Keep the ride short. Fare can move.' }
    default: {
      const _exhaustive: never = priority
      return _exhaustive
    }
  }
}

export function runMatch(seeds: MatchSeed[]): MatchRecord {
  const prepared = seeds.map((seed) => prepareRider(seed))
  if (prepared.length < 2) {
    return {
      id: 'current',
      status: 'solo',
      adopted: 'solo',
      riders: prepared.map((rider) => withTheater(toSolo(rider))),
    }
  }

  const scored = scoreBothVersions(assignV2(assignV1(prepared)))
  const adopted = adoptVersion(
    scored.map((rider) => rider.scoreV1),
    scored.map((rider) => rider.scoreV2),
  )
  const opened = scored.map((rider) => applyAdopted(rider, adopted))
  const settled = silentRecompute(opened)
  const remaining = settled.filter((rider) => !rider.kicked)
  if (remaining.length < 2) {
    return {
      id: 'current',
      status: 'solo',
      adopted: 'solo',
      riders: settled.map((rider) => withTheater(toSolo(rider))),
    }
  }
  return {
    id: 'current',
    status: 'settled',
    adopted,
    riders: settled.map((rider) => withTheater(rider)),
  }
}

function unitRatio(numer: number, denom: number): number {
  if (denom <= 0) return numer >= 0 ? 1 : 0
  return Math.min(1, Math.max(0, numer / denom))
}

function soloFareFromPage(page: RoutePageSnapshot): number {
  return hsinchuMeter({
    distanceKm: page.soloDistanceKm,
    delaySec: delaySecFromTrip(page.soloDistanceKm, page.soloDurationMin),
    night: false,
  })
}

function resolveRoutePage(demand: RiderDemand, routePage?: RoutePageSnapshot): RoutePageSnapshot {
  if (routePage) return routePage
  const pickup = placeById(demand.originId)
  const dropoff = placeById(demand.destinationId)
  const soloDistanceKm = haversineKm(pickup, dropoff)
  return snapshotRoutePage({
    pickup,
    dropoff,
    soloDurationMin: Math.max(1, Math.round((soloDistanceKm / 28) * 60)),
    soloDistanceKm,
    extraTimeMin: demand.maxDetourMin,
    maxWalkMin: demand.maxWalkMin,
    bags: demand.luggageCount,
    accessible: demand.accessibility,
    extraPay: demand.extraPay,
    notes: demand.rawText,
  })
}

function wallsOf(page: RoutePageSnapshot): WallInput {
  return {
    maxWalkMin: page.maxWalkMin,
    maxDetourMin: page.extraTimeMin,
    accessibility: page.accessible,
    luggageCount: page.bags,
  }
}

function emptySlice(soloRideMin: number, soloFare: number): OfferSlice {
  return {
    walkMin: 0,
    rideMin: soloRideMin,
    fare: soloFare,
    soloFare,
    soloRideMin,
    accessible: true,
    luggageOk: true,
  }
}

function prepareRider(seed: MatchSeed): MatchRider {
  const routePage = resolveRoutePage(seed.demand, seed.routePage)
  const soloRideMin = routePage.soloDurationMin
  const soloFare = soloFareFromPage(routePage)
  const blank = emptySlice(soloRideMin, soloFare)
  return {
    username: seed.username,
    riderId: USERNAME_TO_RIDER[seed.username],
    routePage,
    demand: seed.demand,
    structured: parseDemand(seed.demand),
    v1: blank,
    v2: blank,
    scoreV1: 0,
    scoreV2: 0,
    pitch: { axis: 'fare', give: 'walk', note: '' },
    theater: [],
    kicked: false,
    outcome: 'solo',
    finalWalkMin: 0,
    finalRideMin: soloRideMin,
    finalFare: soloFare,
  }
}

function assignV1(riders: MatchRider[]): MatchRider[] {
  const solos = riders.map((rider) => rider.v1.soloFare)
  const totalMeter = Math.round(SHARE_METER_RATIO * solos.reduce((acc, fare) => acc + fare, 0))
  const fares = splitBySolo(solos, totalMeter)
  return riders.map((rider, index) => {
    const walkMin = Math.min(V1_WALK_CAP, rider.routePage.maxWalkMin)
    const rideMin = rider.v1.soloRideMin + Math.min(V1_RIDE_EXTRA_CAP, rider.routePage.extraTimeMin)
    return {
      ...rider,
      v1: {
        ...rider.v1,
        walkMin,
        rideMin,
        fare: fares[index] ?? rider.v1.soloFare,
        accessible: true,
        luggageOk: true,
      },
      pitch: pitchFromDemand(rider.demand),
    }
  })
}

function assignV2(riders: MatchRider[]): MatchRider[] {
  const totalMeter = riders.reduce((acc, rider) => acc + rider.v1.fare, 0)
  const nudged = riders.map((rider) => ({
    ...rider,
    v2: applyPitch(rider.v1, rider.pitch),
  }))
  const head = nudged.slice(0, -1).reduce((acc, rider) => acc + rider.v2.fare, 0)
  return nudged.map((rider, index) => {
    if (index !== nudged.length - 1) return rider
    return { ...rider, v2: { ...rider.v2, fare: totalMeter - head } }
  })
}

function applyPitch(slice: OfferSlice, pitch: Pitch): OfferSlice {
  return applyGive(nudgeAxis(slice, pitch.axis), pitch.give)
}

function nudgeAxis(slice: OfferSlice, axis: SurplusAxis): OfferSlice {
  switch (axis) {
    case 'fare':
      return { ...slice, fare: Math.max(0, slice.fare - FARE_NUDGE) }
    case 'walk':
      return { ...slice, walkMin: Math.max(0, slice.walkMin - 1) }
    case 'ride':
    case 'ontime':
      return { ...slice, rideMin: Math.max(1, slice.rideMin - 1) }
    default: {
      const _exhaustive: never = axis
      return _exhaustive
    }
  }
}

function applyGive(slice: OfferSlice, give: SurplusAxis): OfferSlice {
  switch (give) {
    case 'fare':
      return { ...slice, fare: slice.fare + FARE_NUDGE }
    case 'walk':
      return { ...slice, walkMin: slice.walkMin + WALK_GIVE_MIN }
    case 'ride':
    case 'ontime':
      return { ...slice, rideMin: slice.rideMin + 1 }
    default: {
      const _exhaustive: never = give
      return _exhaustive
    }
  }
}

function scoreBothVersions(riders: MatchRider[]): MatchRider[] {
  return riders.map((rider) => {
    const walls = wallsOf(rider.routePage)
    return {
      ...rider,
      scoreV1: scoreOffer(rider.v1, walls),
      scoreV2: scoreOffer(rider.v2, walls),
    }
  })
}

function applyAdopted(rider: MatchRider, adopted: 'v1' | 'v2'): MatchRider {
  const offer = adopted === 'v2' ? rider.v2 : rider.v1
  return {
    ...rider,
    kicked: false,
    outcome: 'share',
    finalWalkMin: offer.walkMin,
    finalRideMin: offer.rideMin,
    finalFare: offer.fare,
  }
}

function silentRecompute(riders: MatchRider[]): MatchRider[] {
  let current = riders
  for (let pass = 0; pass < 4; pass += 1) {
    const marked = current.map((rider) => {
      if (rider.kicked) return rider
      const offer: OfferSlice = {
        ...rider.v1,
        walkMin: rider.finalWalkMin,
        rideMin: rider.finalRideMin,
        fare: rider.finalFare,
      }
      if (!hitsWall(offer, wallsOf(rider.routePage))) return rider
      return { ...toSolo(rider), kicked: true }
    })
    const remaining = marked.filter((rider) => !rider.kicked)
    if (remaining.length < 2) return marked
    const before = current.filter((rider) => rider.kicked).length
    const after = marked.filter((rider) => rider.kicked).length
    if (after === before) return marked
    const solos = remaining.map((rider) => rider.v1.soloFare)
    const totalMeter = Math.round(SHARE_METER_RATIO * solos.reduce((acc, fare) => acc + fare, 0))
    const fares = splitBySolo(solos, totalMeter)
    let cursor = 0
    current = marked.map((rider) => {
      if (rider.kicked) return rider
      const fare = fares[cursor] ?? rider.finalFare
      cursor += 1
      return { ...rider, outcome: 'share', finalFare: fare }
    })
  }
  return current
}

function toSolo(rider: MatchRider): MatchRider {
  return {
    ...rider,
    outcome: 'solo',
    finalWalkMin: 0,
    finalRideMin: rider.v1.soloRideMin,
    finalFare: rider.v1.soloFare,
  }
}

function withTheater(rider: MatchRider): MatchRider {
  return {
    ...rider,
    theater: buildTheater({
      username: rider.username,
      pitch: rider.pitch,
      outcome: rider.outcome,
      finalWalkMin: rider.finalWalkMin,
      finalRideMin: rider.finalRideMin,
      finalFare: rider.finalFare,
    }),
  }
}
