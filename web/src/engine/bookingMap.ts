import { clipPolyline, rememberPlace } from '../geo.ts'
import type { LatLng, Place, RiderId, RouteStop, StopKind } from '../types.ts'
import { haversineKm, projectOntoSegment } from './corridor.ts'
import type { MatchRecord, MatchRider, Username } from './match.ts'
import { ownRider, sharePaxCount } from './matchView.ts'

export type BookingMapView = {
  origin: Place
  dest: Place
  vias: Place[]
  stops: RouteStop[]
  boardOrder: number
  walkPolylines: LatLng[][]
  clipFrom?: LatLng
  clipTo?: LatLng
}

// 每個畫面請求同一條走廊車路。顯示時只切自己上車到下車的路段。
export function sliceShareDrive(polyline: LatLng[], booking: Pick<BookingMapView, 'clipFrom' | 'clipTo'>): LatLng[] {
  if (!booking.clipFrom || !booking.clipTo) return polyline
  return clipPolyline(polyline, booking.clipFrom, booking.clipTo)
}

const WALK_SKIP_KM = 0.005
const SHARE_MEET_PICKUP_ID = 'share-meet-pickup'
const SHARE_MEET_DROPOFF_ID = 'share-meet-dropoff'

type SpineKind = 'board' | 'alight'

type SpineStop = {
  riderId: RiderId
  kind: SpineKind
  place: Place
  t: number
  order: number
}

// 把成交檔收成付款與追蹤地圖。共乘時每個畫面同一條車路。步行是自己門到扣點。
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
  const plan = match.sharePlan
  const mine = plan?.byRider[me.riderId]
  if (!plan || !mine) return ownSoloView(origin, dest)

  const meetPickup = rememberPlace({
    id: SHARE_MEET_PICKUP_ID,
    name: 'Shared pickup',
    address: '',
    lat: plan.spineA.lat,
    lng: plan.spineA.lng,
  })
  const meetDropoff = rememberPlace({
    id: SHARE_MEET_DROPOFF_ID,
    name: 'Shared dropoff',
    address: '',
    lat: plan.spineB.lat,
    lng: plan.spineB.lng,
  })

  const boards = numberStops(
    shareRiders.flatMap((rider) => {
      const snap = plan.byRider[rider.riderId]
      return snap ? [placedStop(rider, 'board', snap.board, plan.spineA, plan.spineB)] : []
    }),
  )
  const alights = sortStops(
    shareRiders.flatMap((rider) => {
      const snap = plan.byRider[rider.riderId]
      return snap ? [placedStop(rider, 'alight', snap.alight, plan.spineA, plan.spineB)] : []
    }),
  )
  const ownBoard = boards.find((stop) => stop.riderId === me.riderId)
  const ownAlight = alights.find((stop) => stop.riderId === me.riderId)
  if (!ownBoard || !ownAlight) return ownSoloView(origin, dest)

  const ownPickup = rememberPlace(me.routePage.pickup)
  const ownDropoff = rememberPlace(me.routePage.dropoff)
  // 同伴數字是本畫面第幾個上車或下車。數字不含自己。數字不是乘客編號。
  const peers = [
    ...numberStops(boards.filter((stop) => stop.riderId !== me.riderId && onOwnRide(stop, ownBoard, ownAlight))),
    ...numberStops(alights.filter((stop) => stop.riderId !== me.riderId && onOwnRide(stop, ownBoard, ownAlight))),
  ]
  return {
    origin: meetPickup,
    dest: meetDropoff,
    vias: [],
    stops: [
      namedStop('walk-start', 'walkStart', me.riderId, ownPickup.id),
      namedStop('pickup', 'pickup', me.riderId, ownBoard.place.id),
      ...peers.map((stop) => peerStop(stop)),
      namedStop('dropoff', 'dropoff', me.riderId, ownAlight.place.id),
      namedStop('walk-end', 'walkEnd', me.riderId, ownDropoff.id),
    ],
    boardOrder: ownBoard.order,
    walkPolylines: walkLegs(ownPickup, ownBoard.place, ownAlight.place, ownDropoff),
    clipFrom: asLatLng(ownBoard.place),
    clipTo: asLatLng(ownAlight.place),
  }
}

function onOwnRide(item: Pick<SpineStop, 't'>, ownBoard: Pick<SpineStop, 't'>, ownAlight: Pick<SpineStop, 't'>): boolean {
  const lo = Math.min(ownBoard.t, ownAlight.t)
  const hi = Math.max(ownBoard.t, ownAlight.t)
  return item.t >= lo && item.t <= hi
}

function placedStop(
  rider: MatchRider,
  kind: SpineKind,
  point: LatLng,
  spineA: LatLng,
  spineB: LatLng,
): Omit<SpineStop, 'order'> {
  const door = kind === 'board' ? rider.routePage.pickup : rider.routePage.dropoff
  return {
    riderId: rider.riderId,
    kind,
    place: rememberPlace({
      id: kind === 'board' ? `board-${rider.riderId}` : `alight-${rider.riderId}`,
      name: kind === 'board' ? 'Board' : 'Alight',
      address: '',
      lat: point.lat,
      lng: point.lng,
    }),
    t: projectOntoSegment(door, spineA, spineB).tLine,
  }
}

function numberStops(items: Omit<SpineStop, 'order'>[]): SpineStop[] {
  return sortStops(items).map((item, index) => ({ ...item, order: index + 1 }))
}

function sortStops(items: Omit<SpineStop, 'order'>[]): Omit<SpineStop, 'order'>[] {
  return [...items].sort((left, right) => {
    if (left.t !== right.t) return left.t - right.t
    return left.riderId.localeCompare(right.riderId)
  })
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
