import { rememberPlace } from '../geo'
import type { LatLng, Place, RiderId, RouteStop, StopKind } from '../types'
import { commonMeetPoint, haversineKm, personalMeetOnSpine, projectOntoSegment } from './corridor'
import type { MatchRecord, MatchRider, Username } from './match'
import { ownRider, sharePaxCount } from './matchView'

export type BookingMapView = {
  origin: Place
  dest: Place
  vias: Place[]
  stops: RouteStop[]
  boardOrder: number
  walkPolylines: LatLng[][]
}

const WALK_SKIP_KM = 0.005

type SpineKind = 'board' | 'alight'

type SpineStop = {
  riderId: RiderId
  kind: SpineKind
  place: Place
  t: number
  order: number
}

// 把成交檔收成付款與追蹤地圖。共乘時此窗只畫自己的步行與車程切片。
export function bookingMapView(
  match: MatchRecord | null,
  username: Username,
  fallbackOrigin: Place,
  fallbackDest: Place,
): BookingMapView {
  if (!match) return ownSoloView(fallbackOrigin, fallbackDest)

  switch (match.status) {
    case 'collecting': {
      const me = ownRider(match, username)
      return ownSoloView(me?.routePage.pickup ?? fallbackOrigin, me?.routePage.dropoff ?? fallbackDest)
    }
    case 'settled':
    case 'solo':
      return settledView(match, username, fallbackOrigin, fallbackDest)
    default: {
      const _exhaustive: never = match.status
      return _exhaustive
    }
  }
}

function settledView(
  match: MatchRecord,
  username: Username,
  fallbackOrigin: Place,
  fallbackDest: Place,
): BookingMapView {
  const me = ownRider(match, username)
  const origin = me?.routePage.pickup ?? fallbackOrigin
  const dest = me?.routePage.dropoff ?? fallbackDest
  if (!me || !isShareOutcome(me.outcome) || sharePaxCount(match) < 2) {
    return ownSoloView(origin, dest)
  }

  const shareRiders = match.riders.filter((rider) => isShareOutcome(rider.outcome))
  const spineA = commonMeetPoint(shareRiders.map((rider) => rider.routePage.originCircle))
  const spineB = commonMeetPoint(shareRiders.map((rider) => rider.routePage.destCircle))
  if (!spineA || !spineB) return ownSoloView(origin, dest)

  const boards = numberStops(shareRiders.map((rider) => riderBoard(rider, spineA, spineB)))
  const alights = numberStops(shareRiders.map((rider) => riderAlight(rider, spineA, spineB)))
  const ownBoard = boards.find((stop) => stop.riderId === me.riderId)
  const ownAlight = alights.find((stop) => stop.riderId === me.riderId)
  if (!ownBoard || !ownAlight) return ownSoloView(origin, dest)

  const taxi = [...boards, ...alights]
  const start = taxi.findIndex((stop) => stop.kind === 'board' && stop.riderId === me.riderId)
  const end = taxi.findIndex((stop) => stop.kind === 'alight' && stop.riderId === me.riderId)
  if (start < 0 || end < start) return ownSoloView(origin, dest)

  const slice = taxi.slice(start, end + 1)
  const rideOrigin = slice[0]?.place
  const rideDest = slice.at(-1)?.place
  if (!rideOrigin || !rideDest) return ownSoloView(origin, dest)

  const ownPickup = rememberPlace(me.routePage.pickup)
  const ownDropoff = rememberPlace(me.routePage.dropoff)
  const interior = slice.slice(1, -1)
  const vias = interior.map((stop) => stop.place)
  return {
    origin: rideOrigin,
    dest: rideDest,
    vias,
    stops: [
      namedStop('walk-start', 'walkStart', me.riderId, ownPickup.id),
      namedStop('pickup', 'pickup', me.riderId, rideOrigin.id),
      ...interior.map((stop) => peerStop(stop)),
      namedStop('dropoff', 'dropoff', me.riderId, rideDest.id),
      namedStop('walk-end', 'walkEnd', me.riderId, ownDropoff.id),
    ],
    boardOrder: ownBoard.order,
    walkPolylines: walkLegs(ownPickup, rideOrigin, rideDest, ownDropoff),
  }
}

function riderBoard(
  rider: MatchRider,
  spineA: LatLng,
  spineB: LatLng,
): Omit<SpineStop, 'order'> {
  const door = rider.routePage.pickup
  const point = personalMeetOnSpine(door, rider.routePage.originCircle, spineA, spineB)
  return {
    riderId: rider.riderId,
    kind: 'board',
    place: rememberPlace({
      id: `board-${rider.riderId}`,
      name: 'Board',
      address: '',
      lat: point.lat,
      lng: point.lng,
    }),
    t: projectOntoSegment(door, spineA, spineB).tLine,
  }
}

function riderAlight(
  rider: MatchRider,
  spineA: LatLng,
  spineB: LatLng,
): Omit<SpineStop, 'order'> {
  const door = rider.routePage.dropoff
  const point = personalMeetOnSpine(door, rider.routePage.destCircle, spineA, spineB)
  return {
    riderId: rider.riderId,
    kind: 'alight',
    place: rememberPlace({
      id: `alight-${rider.riderId}`,
      name: 'Alight',
      address: '',
      lat: point.lat,
      lng: point.lng,
    }),
    t: projectOntoSegment(door, spineA, spineB).tLine,
  }
}

function numberStops(items: Omit<SpineStop, 'order'>[]): SpineStop[] {
  return [...items]
    .sort((left, right) => {
      if (left.t !== right.t) return left.t - right.t
      return left.riderId.localeCompare(right.riderId)
    })
    .map((item, index) => ({ ...item, order: index + 1 }))
}

function peerStop(item: SpineStop): RouteStop {
  switch (item.kind) {
    case 'board':
      return namedStop(`peer-pickup-${item.riderId}`, 'peerPickup', item.riderId, item.place.id, item.order)
    case 'alight':
      return namedStop(`peer-dropoff-${item.riderId}`, 'peerDropoff', item.riderId, item.place.id, item.order)
    default: {
      const _exhaustive: never = item.kind
      return _exhaustive
    }
  }
}

function namedStop(
  id: string,
  kind: StopKind,
  riderId: RiderId,
  placeId: string,
  order?: number,
): RouteStop {
  return {
    id,
    kind,
    riderId,
    placeId,
    time: '',
    waitMin: 0,
    ...(order == null ? {} : { order }),
  }
}

function walkLegs(doorP: Place, board: Place, alight: Place, doorD: Place): LatLng[][] {
  const legs: LatLng[][] = []
  if (haversineKm(doorP, board) >= WALK_SKIP_KM) {
    legs.push([asLatLng(doorP), asLatLng(board)])
  }
  if (haversineKm(alight, doorD) >= WALK_SKIP_KM) {
    legs.push([asLatLng(alight), asLatLng(doorD)])
  }
  return legs
}

function asLatLng(place: Place): LatLng {
  return { lat: place.lat, lng: place.lng }
}

function isShareOutcome(outcome: MatchRider['outcome']): boolean {
  switch (outcome) {
    case 'share':
      return true
    case 'solo':
      return false
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

function ownSoloView(origin: Place, dest: Place): BookingMapView {
  const pickup = rememberPlace(origin)
  const dropoff = rememberPlace(dest)
  return {
    origin: pickup,
    dest: dropoff,
    vias: [],
    stops: [
      namedStop('pickup', 'pickup', 'A', pickup.id),
      namedStop('dropoff', 'dropoff', 'A', dropoff.id),
    ],
    boardOrder: 1,
    walkPolylines: [],
  }
}
