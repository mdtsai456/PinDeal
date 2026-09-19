import { PLACE_LIST, PLACES } from './data.ts'
import type { LatLng, Place, RiderId, RouteStop } from './types.ts'

const extraPlaces = new Map<string, Place>()

export function rememberPlace(place: Place): Place {
  extraPlaces.set(place.id, place)
  return place
}

export function placeById(id: string): Place {
  const place = extraPlaces.get(id) ?? PLACES[id]
  if (!place) throw new Error(`Unknown place: ${id}`)
  return place
}

export function allPlaces(): Place[] {
  const seen = new Set<string>()
  const list: Place[] = []
  for (const place of [...PLACE_LIST, ...extraPlaces.values()]) {
    if (seen.has(place.id)) continue
    seen.add(place.id)
    list.push(place)
  }
  return list
}

export function searchLocal(query: string): Place[] {
  const q = query.trim().toLowerCase()
  const pool = allPlaces()
  if (!q) return pool.slice(0, 8)
  const parts = q.split(/\s+/).filter(Boolean)
  return pool.filter((place) => {
    const hay = `${place.name} ${place.address}`.toLowerCase()
    return parts.every((part) => hay.includes(part))
  })
}

export function nearestPlace(lat: number, lng: number): Place {
  const pool = allPlaces()
  if (pool.length === 0) throw new Error('Place list is empty')
  return pool.reduce((best, place) => {
    const bestDist = (best.lat - lat) ** 2 + (best.lng - lng) ** 2
    const dist = (place.lat - lat) ** 2 + (place.lng - lng) ** 2
    return dist < bestDist ? place : best
  })
}

export function lineOf(placeIds: string[]): LatLng[] {
  return placeIds.map((id) => {
    const place = placeById(id)
    return { lat: place.lat, lng: place.lng }
  })
}

export function interpolate(points: LatLng[], t: number): LatLng {
  if (points.length === 0) throw new Error('Route has no coordinates')
  if (points.length === 1) return points[0]
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (points.length - 1)
  const i = Math.min(points.length - 2, Math.floor(scaled))
  const local = scaled - i
  const a = points[i]
  const b = points[i + 1]
  return {
    lat: a.lat + (b.lat - a.lat) * local,
    lng: a.lng + (b.lng - a.lng) * local,
  }
}

export function nearestOnLine(point: LatLng, line: LatLng[]): LatLng {
  if (line.length === 0) return point
  return line.reduce((best, candidate) => {
    const bestDist = (best.lat - point.lat) ** 2 + (best.lng - point.lng) ** 2
    const dist = (candidate.lat - point.lat) ** 2 + (candidate.lng - point.lng) ** 2
    return dist < bestDist ? candidate : best
  })
}

export function matchVias(origin: Place, dest: Place, count = 3): Place[] {
  const vias: Place[] = []
  for (let i = 1; i <= count; i += 1) {
    const point = interpolate(
      [
        { lat: origin.lat, lng: origin.lng },
        { lat: dest.lat, lng: dest.lng },
      ],
      i / (count + 1),
    )
    const sign = i % 2 === 0 ? 1 : -1
    const via = rememberPlace({
      id: `via-${origin.id}-${dest.id}-${i}`,
      name: 'Stop',
      address: '',
      lat: point.lat + sign * 0.0018,
      lng: point.lng + sign * 0.0011,
    })
    vias.push(via)
  }
  return vias
}

export function bookingStops(origin: Place, dest: Place, vias: Place[]): RouteStop[] {
  const viaStops: RouteStop[] = vias.map((via, index) => ({
    id: `via-${index}`,
    kind: 'meet',
    riderId: 'A' as RiderId,
    placeId: via.id,
    time: '',
    waitMin: 0,
  }))
  return [
    {
      id: 'pickup',
      kind: 'pickup',
      riderId: 'A',
      placeId: origin.id,
      time: '',
      waitMin: 0,
    },
    ...viaStops,
    {
      id: 'dropoff',
      kind: 'dropoff',
      riderId: 'A',
      placeId: dest.id,
      time: '',
      waitMin: 0,
    },
  ]
}

export function pathOf(places: Place[]): LatLng[] {
  return places.map((place) => ({ lat: place.lat, lng: place.lng }))
}

export function userBookingView(originId: string, destId: string, viaCount = 0) {
  const origin = placeById(originId)
  const dest = placeById(destId)
  const vias = viaCount > 0 ? matchVias(origin, dest, viaCount) : []
  return {
    origin,
    dest,
    vias,
    stops: bookingStops(origin, dest, vias),
    polyline: pathOf([origin, ...vias, dest]),
  }
}