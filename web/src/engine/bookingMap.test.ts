import { describe, expect, it } from 'vitest'
import { PLACES } from '../data'
import { placeById } from '../geo'
import type { Place, RouteStop } from '../types'
import type { MatchRecord, MatchRider, Username } from './match'
import { USERNAME_TO_RIDER } from './match'
import { bookingMapView } from './bookingMap'
import { riderCircles } from './corridor'
import { planShareRoute, type ShareRiderInput } from './shareRoute'

const yuPickup = PLACES.hsinchuStation
const yuDropoff = PLACES.nthuGym
const linPickup = PLACES.hsinchuBeida
const linDropoff = PLACES.nthuLibrary
const chiangPickup = PLACES.hsinchuDongmen
const chiangDropoff = PLACES.nthuMainGate

function rider(username: Username, patch: Partial<MatchRider> = {}): MatchRider {
  return {
    username,
    riderId: USERNAME_TO_RIDER[username],
    routePage: {
      pickup: { id: 'p', name: 'P', address: '', lat: 24.8, lng: 120.97 },
      dropoff: { id: 'd', name: 'D', address: '', lat: 24.79, lng: 120.99 },
      soloDurationMin: 12,
      soloDistanceKm: 2.4,
      extraTimeMin: 8,
      sharedCapMin: 20,
      maxWalkMin: 8,
      bags: 0,
      accessible: false,
      extraPay: false,
      notes: '',
      originCircle: { lat: 24.8, lng: 120.97, radiusKm: 0.64 },
      destCircle: { lat: 24.79, lng: 120.99, radiusKm: 0.64 },
    },
    demand: {
      id: USERNAME_TO_RIDER[username],
      name: username,
      title: username,
      rawText: '',
      originId: 'p',
      destinationId: 'd',
      latestArrival: '',
      maxWaitMin: 5,
      maxWalkMin: 8,
      maxDetourMin: 8,
      luggageCount: 0,
      accessibility: false,
      extraDemand: '',
      priority: 'price',
      extraPay: false,
      privateFloor: { maxFare: 0, note: '' },
    },
    structured: {
      riderId: USERNAME_TO_RIDER[username],
      origin: 'p',
      destination: 'd',
      latestArrival: null,
      maxWaitMin: 5,
      maxWalkMin: 8,
      maxDetourMin: 8,
      luggage: 0,
      accessibility: false,
      extraPay: false,
      priority: 'price',
      extras: [],
    },
    v1: {
      walkMin: 4,
      rideMin: 16,
      fare: 144,
      soloFare: 200,
      soloRideMin: 12,
      accessible: true,
      luggageOk: true,
    },
    v2: {
      walkMin: 4,
      rideMin: 16,
      fare: 144,
      soloFare: 200,
      soloRideMin: 12,
      accessible: true,
      luggageOk: true,
    },
    scoreV1: 1,
    scoreV2: 1,
    pitch: { axis: 'fare', give: 'walk', note: '' },
    theater: [],
    kicked: false,
    outcome: 'share',
    finalWalkMin: 4,
    finalRideMin: 16,
    finalFare: 144,
    ...patch,
  }
}

function withPlaces(username: Username, pickup: Place, dropoff: Place, patch: Partial<MatchRider> = {}): MatchRider {
  return withWalkPlaces(username, pickup, dropoff, 8, patch)
}

function withWalkPlaces(
  username: Username,
  pickup: Place,
  dropoff: Place,
  maxWalkMin: number,
  patch: Partial<MatchRider> = {},
): MatchRider {
  const base = rider(username, patch)
  const radiusKm = maxWalkMin * 0.08
  return {
    ...base,
    routePage: {
      ...base.routePage,
      pickup,
      dropoff,
      maxWalkMin,
      originCircle: { lat: pickup.lat, lng: pickup.lng, radiusKm },
      destCircle: { lat: dropoff.lat, lng: dropoff.lng, radiusKm },
    },
    demand: {
      ...base.demand,
      originId: pickup.id,
      destinationId: dropoff.id,
      maxWalkMin,
    },
  }
}

function planFromShare(riders: MatchRider[]) {
  const shareRiders = riders.filter((rider) => rider.outcome === 'share')
  return planShareRoute(
    shareRiders.map((rider) =>
      shareInput(rider.riderId, rider.routePage.pickup, rider.routePage.dropoff, rider.routePage.maxWalkMin),
    ),
  )
}

function recordOf(
  status: MatchRecord['status'],
  riders: MatchRider[],
  adopted: MatchRecord['adopted'] = 'v1',
  sharePlan = planFromShare(riders),
): MatchRecord {
  return {
    id: 'current',
    status,
    adopted,
    joins: [],
    riders,
    sharePlan,
    lastJoinAt: null,
  }
}

const collecting: MatchRecord = recordOf(
  'collecting',
  [withPlaces('Yu', yuPickup, yuDropoff, { theater: [], outcome: 'solo', finalFare: 0 })],
  'solo',
  null,
)

const settled: MatchRecord = recordOf('settled', [
  withPlaces('Yu', yuPickup, yuDropoff, {
    theater: ['I scored this shared plan against your walls only.', 'Your fare is NT$144.'],
    outcome: 'share',
    finalFare: 144,
  }),
  withPlaces('Lin', linPickup, linDropoff, {
    theater: ['Lin should never appear on Yu screen.', 'Your fare is NT$260.'],
    outcome: 'share',
    finalFare: 260,
  }),
  withPlaces('Chiang', chiangPickup, chiangDropoff, {
    theater: ['Your fare is NT$280.'],
    outcome: 'solo',
    kicked: true,
    finalFare: 280,
  }),
])

const threeShare: MatchRecord = recordOf('settled', [
  withPlaces('Yu', yuPickup, yuDropoff, { outcome: 'share' }),
  withPlaces('Lin', linPickup, linDropoff, { outcome: 'share' }),
  withPlaces('Chiang', chiangPickup, chiangDropoff, { outcome: 'share' }),
])

function stopKinds(view: ReturnType<typeof bookingMapView>) {
  return view.stops.map((stop) => stop.kind)
}

function peerStops(view: ReturnType<typeof bookingMapView>): RouteStop[] {
  return view.stops.filter((stop) => stop.kind === 'peerPickup' || stop.kind === 'peerDropoff')
}

function pathIds(view: ReturnType<typeof bookingMapView>): string[] {
  return [view.origin.id, ...view.vias.map((place) => place.id), view.dest.id]
}

describe('bookingMapView fallback', () => {
  it('無 match 時只有自己上車與下車，vias 為空', () => {
    const view = bookingMapView(null, 'Yu', yuPickup, yuDropoff)
    expect(stopKinds(view)).toEqual(['pickup', 'dropoff'])
    expect(view.stops[0]?.placeId).toBe(yuPickup.id)
    expect(view.stops.at(-1)?.placeId).toBe(yuDropoff.id)
    expect(view.vias).toEqual([])
    expect(view.walkPolylines).toEqual([])
    expect(view.origin.id).toBe(yuPickup.id)
    expect(view.dest.id).toBe(yuDropoff.id)
    expect(view.boardOrder).toBe(1)
  })

  it('collecting 時只有自己上車與下車，vias 為空', () => {
    const view = bookingMapView(collecting, 'Yu', yuPickup, yuDropoff)
    expect(stopKinds(view)).toEqual(['pickup', 'dropoff'])
    expect(peerStops(view)).toEqual([])
    expect(view.vias).toEqual([])
    expect(view.walkPolylines).toEqual([])
    expect(view.boardOrder).toBe(1)
  })

  it('自己獨乘時只有自己兩點，不含同伴站', () => {
    const view = bookingMapView(settled, 'Chiang', chiangPickup, chiangDropoff)
    expect(stopKinds(view)).toEqual(['pickup', 'dropoff'])
    expect(view.stops[0]?.placeId).toBe(chiangPickup.id)
    expect(view.stops.at(-1)?.placeId).toBe(chiangDropoff.id)
    expect(peerStops(view)).toEqual([])
    expect(view.vias).toEqual([])
    expect(view.walkPolylines).toEqual([])
    expect(view.boardOrder).toBe(1)
  })

  it('付費人數少於 2 時退回自己兩點', () => {
    const thin = recordOf(
      'settled',
      [
        withPlaces('Yu', yuPickup, yuDropoff, { outcome: 'share' }),
        withPlaces('Lin', linPickup, linDropoff, { outcome: 'solo', kicked: true }),
      ],
      'v1',
      null,
    )
    const view = bookingMapView(thin, 'Yu', yuPickup, yuDropoff)
    expect(stopKinds(view)).toEqual(['pickup', 'dropoff'])
    expect(view.vias).toEqual([])
    expect(view.walkPolylines).toEqual([])
    expect(peerStops(view)).toEqual([])
    expect(view.boardOrder).toBe(1)
  })
})

function walkEnds(view: ReturnType<typeof bookingMapView>) {
  const first = view.walkPolylines[0]?.[0]
  const last = view.walkPolylines.at(-1)?.at(-1)
  return { first, last }
}

describe('bookingMapView shared path', () => {
  it('三人同畫面共用同一條車路端點，步行仍是自己門到扣點', () => {
    const yu = bookingMapView(threeShare, 'Yu', yuPickup, yuDropoff)
    const lin = bookingMapView(threeShare, 'Lin', linPickup, linDropoff)
    const chiang = bookingMapView(threeShare, 'Chiang', chiangPickup, chiangDropoff)
    expect(yu.origin.id).toBe('share-meet-pickup')
    expect(yu.dest.id).toBe('share-meet-dropoff')
    expect(lin.origin).toEqual(yu.origin)
    expect(lin.dest).toEqual(yu.dest)
    expect(chiang.origin).toEqual(yu.origin)
    expect(chiang.dest).toEqual(yu.dest)
    expect(yu.vias).toEqual([])
    expect(lin.vias).toEqual([])
    expect(chiang.vias).toEqual([])
    expect(pathIds(yu)).toEqual(['share-meet-pickup', 'share-meet-dropoff'])
    expect(pathIds(lin)).toEqual(pathIds(yu))
    expect(chiang.boardOrder).toBe(1)
    expect(yu.boardOrder).toBe(2)
    expect(lin.boardOrder).toBe(3)
    expect([yu.boardOrder, lin.boardOrder, chiang.boardOrder]).not.toEqual([1, 1, 1])
  })

  it('Yu 畫面只標自己車上會遇到的同伴站，上車前與下車後的同伴不上圖', () => {
    const yu = bookingMapView(threeShare, 'Yu', yuPickup, yuDropoff)
    expect(yu.stops.find((stop) => stop.kind === 'walkStart')?.placeId).toBe(yuPickup.id)
    expect(yu.stops.find((stop) => stop.kind === 'pickup')?.placeId).toBe('board-A')
    expect(yu.stops.find((stop) => stop.kind === 'dropoff')?.placeId).toBe('alight-A')
    expect(yu.stops.find((stop) => stop.kind === 'walkEnd')?.placeId).toBe(yuDropoff.id)
    expect(yu.stops.find((stop) => stop.kind === 'pickup')?.order).toBeUndefined()
    expect(yu.stops.find((stop) => stop.kind === 'dropoff')?.order).toBeUndefined()
    expect(peerStops(yu)).toEqual([
      expect.objectContaining({ kind: 'peerPickup', riderId: 'B', order: 1, placeId: 'board-B' }),
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'C', order: 1, placeId: 'alight-C' }),
    ])
    const placeIds = yu.stops.map((stop) => stop.placeId)
    expect(placeIds).not.toContain('board-C')
    expect(placeIds).not.toContain('alight-B')
    expect(placeIds).not.toContain(linPickup.id)
    expect(placeIds).not.toContain(linDropoff.id)
    expect(placeIds).not.toContain(chiangPickup.id)
    expect(placeIds).not.toContain(chiangDropoff.id)
    expect(pathIds(yu)).toEqual(['share-meet-pickup', 'share-meet-dropoff'])
    expect(yu.clipFrom).toEqual({ lat: placeById('board-A').lat, lng: placeById('board-A').lng })
    expect(yu.clipTo).toEqual({ lat: placeById('alight-A').lat, lng: placeById('alight-A').lng })
  })

  it('Lin 與 Chiang 車路與 Yu 相同，門與扣點仍是自己的', () => {
    const yu = bookingMapView(threeShare, 'Yu', yuPickup, yuDropoff)
    const lin = bookingMapView(threeShare, 'Lin', linPickup, linDropoff)
    const chiang = bookingMapView(threeShare, 'Chiang', chiangPickup, chiangDropoff)
    expect(pathIds(lin)).toEqual(pathIds(yu))
    expect(pathIds(chiang)).toEqual(pathIds(yu))
    expect(lin.stops[0]?.placeId).toBe(linPickup.id)
    expect(lin.stops.at(-1)?.placeId).toBe(linDropoff.id)
    expect(lin.stops.find((stop) => stop.kind === 'pickup')?.placeId).toBe('board-B')
    expect(chiang.stops[0]?.placeId).toBe(chiangPickup.id)
    expect(chiang.stops.at(-1)?.placeId).toBe(chiangDropoff.id)
    expect(chiang.stops.find((stop) => stop.kind === 'pickup')?.placeId).toBe('board-C')
    expect(peerStops(lin)).toEqual([
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'C', order: 1, placeId: 'alight-C' }),
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'A', order: 2, placeId: 'alight-A' }),
    ])
    expect(peerStops(chiang)).toEqual([
      expect.objectContaining({ kind: 'peerPickup', riderId: 'A', order: 1, placeId: 'board-A' }),
      expect.objectContaining({ kind: 'peerPickup', riderId: 'B', order: 2, placeId: 'board-B' }),
    ])
  })

  it('walkPolylines 端點是自己起訖', () => {
    const yu = bookingMapView(threeShare, 'Yu', yuPickup, yuDropoff)
    const lin = bookingMapView(threeShare, 'Lin', linPickup, linDropoff)
    const yuEnds = walkEnds(yu)
    const linEnds = walkEnds(lin)
    expect(yuEnds.first).toEqual({ lat: yuPickup.lat, lng: yuPickup.lng })
    expect(yuEnds.last).toEqual({ lat: yuDropoff.lat, lng: yuDropoff.lng })
    expect(linEnds.first).toEqual({ lat: linPickup.lat, lng: linPickup.lng })
    expect(linEnds.last).toEqual({ lat: linDropoff.lat, lng: linDropoff.lng })
  })

  it('kicked 與 solo 同伴不上圖', () => {
    const yu = bookingMapView(settled, 'Yu', yuPickup, yuDropoff)
    const placeIds = yu.stops.map((stop) => stop.placeId)
    expect(placeIds).not.toContain(chiangPickup.id)
    expect(placeIds).not.toContain(chiangDropoff.id)
    expect(placeIds).not.toContain('board-C')
    expect(placeIds).not.toContain('alight-C')
    expect(pathIds(yu)).not.toContain(chiangPickup.id)
    expect(pathIds(yu)).not.toContain(chiangDropoff.id)
    expect(yu.origin.id).toBe('share-meet-pickup')
    expect(yu.dest.id).toBe('share-meet-dropoff')
    expect(yu.stops[0]?.kind).toBe('walkStart')
    expect(yu.stops.at(-1)?.kind).toBe('walkEnd')
    expect(yu.stops[0]?.placeId).toBe(yuPickup.id)
    expect(yu.stops.at(-1)?.placeId).toBe(yuDropoff.id)
  })

  it('自訂 place.id 經 rememberPlace 後自己門與上車仍可用', () => {
    const customPickup: Place = {
      id: 'custom-cafe-booking-map',
      name: 'Custom Cafe',
      address: '',
      lat: 24.804,
      lng: 120.968,
    }
    const record = recordOf('settled', [
      withPlaces('Yu', customPickup, yuDropoff, { outcome: 'share' }),
      withPlaces('Lin', linPickup, linDropoff, { outcome: 'share' }),
    ])
    const view = bookingMapView(record, 'Yu', customPickup, yuDropoff)
    expect(placeById(customPickup.id).name).toBe('Custom Cafe')
    expect(placeById(view.origin.id).lat).toBeCloseTo(view.origin.lat)
    expect(view.origin.id).toBe('share-meet-pickup')
    expect(view.stops.some((stop) => stop.placeId === customPickup.id && stop.kind === 'walkStart')).toBe(true)
    expect(view.stops.some((stop) => stop.placeId === 'board-A' && stop.kind === 'pickup')).toBe(true)
    expect(walkEnds(view).first).toEqual({ lat: customPickup.lat, lng: customPickup.lng })
  })

  it('四人門距拉開時，同伴數字是本畫面第幾個上車或下車，不是乘客編號', () => {
    const yangP: Place = { id: 'yang-p', name: 'Yang door', address: '', lat: 24.8024, lng: 120.9712 }
    const chiangP: Place = { id: 'chiang-p', name: 'Chiang door', address: '', lat: 24.8019, lng: 120.9736 }
    const yuP: Place = { id: 'yu-p', name: 'Yu door', address: '', lat: 24.8018, lng: 120.9759 }
    const linP: Place = { id: 'lin-p', name: 'Lin door', address: '', lat: 24.8020, lng: 120.9785 }
    const yangD: Place = { id: 'yang-d', name: 'Yang dest', address: '', lat: 24.795, lng: 120.9972 }
    const chiangD: Place = { id: 'chiang-d', name: 'Chiang dest', address: '', lat: 24.7953, lng: 120.9952 }
    const yuD: Place = { id: 'yu-d', name: 'Yu dest', address: '', lat: 24.7956, lng: 120.9932 }
    const linD: Place = { id: 'lin-d', name: 'Lin dest', address: '', lat: 24.7964, lng: 120.9912 }
    const fourShare = recordOf(
      'settled',
      [
        withWalkPlaces('Yang', yangP, yangD, 10, { outcome: 'share' }),
        withWalkPlaces('Chiang', chiangP, chiangD, 6, { outcome: 'share' }),
        withWalkPlaces('Yu', yuP, yuD, 8, { outcome: 'share' }),
        withWalkPlaces('Lin', linP, linD, 10, { outcome: 'share' }),
      ],
      'v2',
    )
    const yang = bookingMapView(fourShare, 'Yang', yangP, yangD)
    const chiang = bookingMapView(fourShare, 'Chiang', chiangP, chiangD)
    const yu = bookingMapView(fourShare, 'Yu', yuP, yuD)
    const lin = bookingMapView(fourShare, 'Lin', linP, linD)
    expect([yang.boardOrder, chiang.boardOrder, yu.boardOrder, lin.boardOrder]).toEqual([1, 2, 3, 4])
    expect(peerStops(yang).map((stop) => `${stop.kind}:${stop.order}`)).toEqual([
      'peerPickup:1',
      'peerPickup:2',
      'peerPickup:3',
      'peerDropoff:1',
      'peerDropoff:2',
      'peerDropoff:3',
    ])
    expect(peerStops(yang).filter((stop) => stop.kind === 'peerDropoff')).toEqual([
      expect.objectContaining({ riderId: 'B', order: 1, placeId: 'alight-B' }),
      expect.objectContaining({ riderId: 'A', order: 2, placeId: 'alight-A' }),
      expect.objectContaining({ riderId: 'C', order: 3, placeId: 'alight-C' }),
    ])
    expect(yang.stops.find((stop) => stop.kind === 'pickup')?.order).toBeUndefined()
    expect(yang.stops.find((stop) => stop.kind === 'dropoff')?.order).toBeUndefined()
    expect(chiang.stops.find((stop) => stop.kind === 'pickup')?.order).toBeUndefined()
    expect(chiang.stops.find((stop) => stop.kind === 'dropoff')?.order).toBeUndefined()
    expect(peerStops(chiang).map((stop) => `${stop.kind}:${stop.order}`)).toEqual([
      'peerPickup:1',
      'peerPickup:2',
      'peerDropoff:1',
      'peerDropoff:2',
    ])
    expect(peerStops(yu)).toEqual([
      expect.objectContaining({ kind: 'peerPickup', riderId: 'B', order: 1, placeId: 'board-B' }),
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'B', order: 1, placeId: 'alight-B' }),
    ])
    expect(peerStops(lin)).toEqual([])
    expect(peerStops(yang).some((stop) => stop.placeId === linP.id)).toBe(false)
  })

  it('步行與扣點只讀 match.sharePlan，不重算走廊', () => {
    const twoInputs = [
      shareInput('A', yuPickup, yuDropoff, 8),
      shareInput('B', linPickup, linDropoff, 8),
    ]
    const threeInputs = [...twoInputs, shareInput('C', chiangPickup, chiangDropoff, 8)]
    const twoPlan = planShareRoute(twoInputs)
    const threePlan = planShareRoute(threeInputs)
    expect(twoPlan).not.toBeNull()
    expect(threePlan).not.toBeNull()
    expect(twoPlan?.byRider.A?.board).not.toEqual(threePlan?.byRider.A?.board)

    const record = {
      ...threeShare,
      sharePlan: twoPlan,
    }
    const yu = bookingMapView(record, 'Yu', yuPickup, yuDropoff)
    expect(yu.clipFrom).toEqual(twoPlan?.byRider.A?.board)
    expect(yu.clipTo).toEqual(twoPlan?.byRider.A?.alight)
    expect(yu.clipFrom).not.toEqual(threePlan?.byRider.A?.board)
    const firstWalk = yu.walkPolylines[0]
    expect(firstWalk?.[0]).toEqual({ lat: yuPickup.lat, lng: yuPickup.lng })
    expect(firstWalk?.at(-1)).toEqual(twoPlan?.byRider.A?.board)
  })
})

function shareInput(riderId: ShareRiderInput['riderId'], pickup: Place, dropoff: Place, maxWalkMin: number): ShareRiderInput {
  const circles = riderCircles(pickup, dropoff, maxWalkMin)
  return {
    riderId,
    pickup,
    dropoff,
    originCircle: circles.origin,
    destCircle: circles.dest,
    maxWalkMin,
  }
}
