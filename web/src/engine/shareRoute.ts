import type { LatLng, RiderId } from '../types.ts'
import {
  WALK_M_PER_MIN,
  commonMeetPoint,
  haversineKm,
  personalMeetOnSpine,
  type Circle,
} from './corridor.ts'

export type ShareRiderInput = {
  riderId: RiderId
  pickup: LatLng
  dropoff: LatLng
  originCircle: Circle
  destCircle: Circle
  maxWalkMin: number
}

export type ShareRiderSnap = {
  board: LatLng
  alight: LatLng
  walkMin: number
}

export type ShareRoutePlan = {
  spineA: LatLng
  spineB: LatLng
  byRider: Partial<Record<RiderId, ShareRiderSnap>>
}

// 門到扣點的步行分鐘。速度與圓半徑同一常數。
export function walkMinBetween(from: LatLng, to: LatLng): number {
  return Math.max(0, Math.ceil(haversineKm(from, to) / (WALK_M_PER_MIN / 1000)))
}

// 先定匿名走廊，再各人在自己 Max walk 內扣到軸上。圈無交集則回 null。
export function planShareRoute(riders: ShareRiderInput[]): ShareRoutePlan | null {
  if (riders.length < 2) return null
  const spineA = commonMeetPoint(riders.map((rider) => rider.originCircle))
  const spineB = commonMeetPoint(riders.map((rider) => rider.destCircle))
  if (!spineA || !spineB) return null

  const byRider: ShareRoutePlan['byRider'] = {}
  for (const rider of riders) {
    const board = personalMeetOnSpine(rider.pickup, rider.originCircle, spineA, spineB)
    const alight = personalMeetOnSpine(rider.dropoff, rider.destCircle, spineA, spineB)
    const raw = Math.max(walkMinBetween(rider.pickup, board), walkMinBetween(rider.dropoff, alight))
    byRider[rider.riderId] = {
      board,
      alight,
      walkMin: Math.min(rider.maxWalkMin, raw),
    }
  }
  return { spineA, spineB, byRider }
}
