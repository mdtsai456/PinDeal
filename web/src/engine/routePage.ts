import type { Place, RiderDemand, Username } from '../types.ts'
import { riderCircles, type Circle } from './corridor.ts'

export type RoutePageSnapshot = {
  pickup: Place
  dropoff: Place
  soloDurationMin: number
  soloDistanceKm: number
  extraTimeMin: number
  sharedCapMin: number
  maxWalkMin: number
  bags: number
  accessible: boolean
  extraPay: boolean
  notes: string
  originCircle: Circle
  destCircle: Circle
}

export type MatchJoinBody = {
  username: Username
  demand: RiderDemand
  routePage: RoutePageSnapshot
}

export function snapshotRoutePage(input: {
  pickup: Place
  dropoff: Place
  soloDurationMin: number
  soloDistanceKm: number
  extraTimeMin: number
  maxWalkMin: number
  bags: number
  accessible: boolean
  extraPay: boolean
  notes: string
}): RoutePageSnapshot {
  const circles = riderCircles(input.pickup, input.dropoff, input.maxWalkMin)
  return {
    pickup: input.pickup,
    dropoff: input.dropoff,
    soloDurationMin: input.soloDurationMin,
    soloDistanceKm: input.soloDistanceKm,
    extraTimeMin: input.extraTimeMin,
    sharedCapMin: input.soloDurationMin + input.extraTimeMin,
    maxWalkMin: input.maxWalkMin,
    bags: input.bags,
    accessible: input.accessible,
    extraPay: input.extraPay,
    notes: input.notes,
    originCircle: circles.origin,
    destCircle: circles.dest,
  }
}

