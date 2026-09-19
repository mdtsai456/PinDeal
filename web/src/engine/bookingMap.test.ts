import { describe, expect, it } from 'vitest'
import { PLACES } from '../data'
import { placeById } from '../geo'
import type { Place, RouteStop } from '../types'
import type { MatchRecord, MatchRider, Username } from './match'
import { USERNAME_TO_RIDER } from './match'
import { bookingMapView } from './bookingMap'

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
  const base = rider(username, patch)
  return {
    ...base,
    routePage: {
      ...base.routePage,
      pickup,
      dropoff,
      originCircle: { lat: pickup.lat, lng: pickup.lng, radiusKm: 0.64 },
      destCircle: { lat: dropoff.lat, lng: dropoff.lng, radiusKm: 0.64 },
    },
    demand: {
      ...base.demand,
      originId: pickup.id,
      destinationId: dropoff.id,
    },
  }
}

const collecting: MatchRecord = {
  id: 'current',
  status: 'collecting',
  adopted: 'solo',
  riders: [withPlaces('Yu', yuPickup, yuDropoff, { theater: [], outcome: 'solo', finalFare: 0 })],
}

const settled: MatchRecord = {
  id: 'current',
  status: 'settled',
  adopted: 'v1',
  riders: [
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
  ],
}

const threeShare: MatchRecord = {
  id: 'current',
  status: 'settled',
  adopted: 'v1',
  riders: [
    withPlaces('Yu', yuPickup, yuDropoff, { outcome: 'share' }),
    withPlaces('Lin', linPickup, linDropoff, { outcome: 'share' }),
    withPlaces('Chiang', chiangPickup, chiangDropoff, { outcome: 'share' }),
  ],
}

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
    const thin: MatchRecord = {
      ...settled,
      riders: [
        withPlaces('Yu', yuPickup, yuDropoff, { outcome: 'share' }),
        withPlaces('Lin', linPickup, linDropoff, { outcome: 'solo', kicked: true }),
      ],
    }
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
  it('三人同序，各窗 origin／dest 是自己的上車與下車', () => {
    const yu = bookingMapView(threeShare, 'Yu', yuPickup, yuDropoff)
    const lin = bookingMapView(threeShare, 'Lin', linPickup, linDropoff)
    const chiang = bookingMapView(threeShare, 'Chiang', chiangPickup, chiangDropoff)
    expect(yu.origin.id).toBe('board-A')
    expect(yu.dest.id).toBe('alight-A')
    expect(lin.origin.id).toBe('board-B')
    expect(lin.dest.id).toBe('alight-B')
    expect(chiang.origin.id).toBe('board-C')
    expect(chiang.dest.id).toBe('alight-C')
    expect(yu.origin.id).not.toBe(lin.origin.id)
    expect(yu.dest.id).not.toBe(lin.dest.id)
    expect(pathIds(yu)).not.toContain('share-meet-pickup')
    expect(pathIds(yu)).not.toContain('share-meet-dropoff')
    expect(chiang.boardOrder).toBe(1)
    expect(yu.boardOrder).toBe(2)
    expect(lin.boardOrder).toBe(3)
    expect([yu.boardOrder, lin.boardOrder, chiang.boardOrder]).not.toEqual([1, 1, 1])
  })

  it('Yu 切片含 Lin 上車與 Chiang 下車，不含 Chiang 上車與 Lin 下車', () => {
    const yu = bookingMapView(threeShare, 'Yu', yuPickup, yuDropoff)
    expect(stopKinds(yu)).toEqual(['walkStart', 'pickup', 'peerPickup', 'peerDropoff', 'dropoff', 'walkEnd'])
    expect(yu.stops.find((stop) => stop.kind === 'walkStart')?.placeId).toBe(yuPickup.id)
    expect(yu.stops.find((stop) => stop.kind === 'pickup')?.placeId).toBe('board-A')
    expect(yu.stops.find((stop) => stop.kind === 'dropoff')?.placeId).toBe('alight-A')
    expect(yu.stops.find((stop) => stop.kind === 'walkEnd')?.placeId).toBe(yuDropoff.id)
    const peers = peerStops(yu)
    expect(peers).toEqual([
      expect.objectContaining({ kind: 'peerPickup', riderId: 'B', order: 3, placeId: 'board-B' }),
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'C', order: 1, placeId: 'alight-C' }),
    ])
    const placeIds = yu.stops.map((stop) => stop.placeId)
    expect(placeIds).not.toContain('board-C')
    expect(placeIds).not.toContain('alight-B')
    expect(placeIds).not.toContain(linPickup.id)
    expect(placeIds).not.toContain(linDropoff.id)
    expect(placeIds).not.toContain(chiangPickup.id)
    expect(placeIds).not.toContain(chiangDropoff.id)
    expect(pathIds(yu)).toEqual(['board-A', 'board-B', 'alight-C', 'alight-A'])
  })

  it('Lin 與 Chiang 各窗只含自己門與切片內同伴點', () => {
    const lin = bookingMapView(threeShare, 'Lin', linPickup, linDropoff)
    const chiang = bookingMapView(threeShare, 'Chiang', chiangPickup, chiangDropoff)
    expect(stopKinds(lin)).toEqual(['walkStart', 'pickup', 'peerDropoff', 'peerDropoff', 'dropoff', 'walkEnd'])
    expect(lin.stops[0]?.placeId).toBe(linPickup.id)
    expect(lin.stops.at(-1)?.placeId).toBe(linDropoff.id)
    expect(peerStops(lin)).toEqual([
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'C', order: 1, placeId: 'alight-C' }),
      expect.objectContaining({ kind: 'peerDropoff', riderId: 'A', order: 2, placeId: 'alight-A' }),
    ])
    expect(pathIds(lin)).toEqual(['board-B', 'alight-C', 'alight-A', 'alight-B'])
    expect(stopKinds(chiang)).toEqual(['walkStart', 'pickup', 'peerPickup', 'peerPickup', 'dropoff', 'walkEnd'])
    expect(chiang.stops[0]?.placeId).toBe(chiangPickup.id)
    expect(chiang.stops.at(-1)?.placeId).toBe(chiangDropoff.id)
    expect(peerStops(chiang)).toEqual([
      expect.objectContaining({ kind: 'peerPickup', riderId: 'A', order: 2, placeId: 'board-A' }),
      expect.objectContaining({ kind: 'peerPickup', riderId: 'B', order: 3, placeId: 'board-B' }),
    ])
    expect(pathIds(chiang)).toEqual(['board-C', 'board-A', 'board-B', 'alight-C'])
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
    expect(yu.origin.id).toBe('board-A')
    expect(yu.dest.id).toBe('alight-A')
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
    const record: MatchRecord = {
      ...settled,
      riders: [
        withPlaces('Yu', customPickup, yuDropoff, { outcome: 'share' }),
        withPlaces('Lin', linPickup, linDropoff, { outcome: 'share' }),
      ],
    }
    const view = bookingMapView(record, 'Yu', customPickup, yuDropoff)
    expect(placeById(customPickup.id).name).toBe('Custom Cafe')
    expect(placeById(view.origin.id).lat).toBeCloseTo(view.origin.lat)
    expect(view.origin.id).toBe('board-A')
    expect(view.stops.some((stop) => stop.placeId === customPickup.id && stop.kind === 'walkStart')).toBe(true)
    expect(view.stops.some((stop) => stop.placeId === 'board-A' && stop.kind === 'pickup')).toBe(true)
    expect(walkEnds(view).first).toEqual({ lat: customPickup.lat, lng: customPickup.lng })
  })
})
