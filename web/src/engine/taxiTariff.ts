import { placeById } from '../geo.ts'
import type { RiderDemand } from '../types.ts'
import { haversineKm } from './corridor.ts'

export const HSINCHU_TAXI = {
  flagNt: 100,
  flagKm: 1.25,
  incrementM: 200,
  incrementNt: 5,
  waitSec: 80,
  waitNt: 5,
  nightExtraNt: 20,
  slowSpeedKmh: 5,
} as const

// TODO(user-confirm): Demo 巡航。不是法令。見計畫 Needs confirm #4。
export const DEMO_CRUISE_KMH = 30

export function extraDistanceJumps(distanceKm: number): number {
  if (distanceKm <= HSINCHU_TAXI.flagKm) return 0
  const extraM = (distanceKm - HSINCHU_TAXI.flagKm) * 1000
  return Math.ceil(extraM / HSINCHU_TAXI.incrementM)
}

export function waitJumps(delaySec: number): number {
  if (delaySec <= 0) return 0
  return Math.floor(delaySec / HSINCHU_TAXI.waitSec)
}

export function delaySecFromTrip(distanceKm: number, durationMin: number): number {
  const movingSec = (distanceKm / DEMO_CRUISE_KMH) * 3600
  return Math.max(0, Math.round(durationMin * 60 - movingSec))
}

export function hsinchuMeter(input: {
  distanceKm: number
  delaySec?: number
  night?: boolean
}): number {
  const distance = HSINCHU_TAXI.flagNt + extraDistanceJumps(input.distanceKm) * HSINCHU_TAXI.incrementNt
  const wait = waitJumps(input.delaySec ?? 0) * HSINCHU_TAXI.waitNt
  const night = input.night ? HSINCHU_TAXI.nightExtraNt : 0
  return distance + wait + night
}

export function soloFareFromDemand(demand: RiderDemand): number {
  const origin = placeById(demand.originId)
  const dest = placeById(demand.destinationId)
  const distanceKm = haversineKm(origin, dest)
  const cruiseDurationMin = Math.max(1, Math.round((distanceKm / DEMO_CRUISE_KMH) * 60))
  return hsinchuMeter({
    distanceKm,
    delaySec: delaySecFromTrip(distanceKm, cruiseDurationMin),
  })
}
