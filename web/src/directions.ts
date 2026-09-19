import { loadGoogleMaps } from './maps'
import type { LatLng, Place } from './types'

export type DrivingRoute = {
  polyline: LatLng[]
  durationMin: number
  distanceKm: number
  source: 'google' | 'osrm' | 'straight'
}

const EARTH_KM = 6371

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function estimateDurationMin(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / 28) * 60))
}

export function straightRoute(origin: Place, dest: Place, vias: Place[] = []): DrivingRoute {
  const stops = [origin, ...vias, dest]
  let distanceKm = 0
  for (let i = 1; i < stops.length; i += 1) {
    distanceKm += haversineKm(stops[i - 1], stops[i])
  }
  return {
    polyline: stops.map((place) => ({ lat: place.lat, lng: place.lng })),
    durationMin: estimateDurationMin(distanceKm),
    distanceKm,
    source: 'straight',
  }
}

export function osrmCoords(places: Place[]): string {
  return places.map((place) => `${place.lng},${place.lat}`).join(';')
}

type GoogleLatLng = { lat: () => number; lng: () => number }

type GoogleDirectionsResult = {
  routes: {
    overview_path: GoogleLatLng[]
    legs: { duration?: { value: number }; distance?: { value: number } }[]
  }[]
}

async function googleDrive(origin: Place, dest: Place, vias: Place[] = []): Promise<DrivingRoute | null> {
  const api = await loadGoogleMaps()
  const DirectionsService = api?.maps.DirectionsService
  if (!DirectionsService) return null
  return new Promise((resolve) => {
    const service = new DirectionsService()
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: dest.lat, lng: dest.lng },
        travelMode: api.maps.TravelMode?.DRIVING ?? 'DRIVING',
        waypoints: vias.map((place) => ({ location: { lat: place.lat, lng: place.lng } })),
      },
      (raw, status) => {
        const result = raw as GoogleDirectionsResult | null
        const route = result?.routes[0]
        const path = route?.overview_path ?? []
        const legs = route?.legs ?? []
        if (status !== 'OK' || path.length < 2) {
          resolve(null)
          return
        }
        const durationSec = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0)
        const distanceM = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0)
        resolve({
          polyline: path.map((point) => ({ lat: point.lat(), lng: point.lng() })),
          durationMin: Math.max(1, Math.round(durationSec / 60)),
          distanceKm: distanceM / 1000,
          source: 'google',
        })
      },
    )
  })
}

async function osrmDrive(origin: Place, dest: Place, vias: Place[] = []): Promise<DrivingRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${osrmCoords([origin, ...vias, dest])}?overview=full&geometries=geojson`
  const response = await fetch(url)
  if (!response.ok) return null
  const payload = (await response.json()) as {
    routes?: { duration: number; distance: number; geometry?: { coordinates: number[][] } }[]
  }
  const route = payload.routes?.[0]
  const coords = route?.geometry?.coordinates
  if (!route || !coords || coords.length < 2) return null
  return {
    polyline: coords.map(([lng, lat]) => ({ lat, lng })),
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    distanceKm: route.distance / 1000,
    source: 'osrm',
  }
}

export async function fetchDrivingRoute(origin: Place, dest: Place, vias: Place[] = []): Promise<DrivingRoute> {
  const fallback = straightRoute(origin, dest, vias)
  try {
    const google = await googleDrive(origin, dest, vias)
    if (google) return google
  } catch {
  }
  try {
    const osrm = await osrmDrive(origin, dest, vias)
    if (osrm) return osrm
  } catch {
  }
  return fallback
}
