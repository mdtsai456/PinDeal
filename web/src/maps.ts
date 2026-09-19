import { rememberPlace, searchLocal } from './geo'
import type { Place } from './types'

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: { input: string; componentRestrictions?: { country: string } },
    callback: (predictions: { place_id: string; description: string }[] | null) => void,
  ) => void
}

type GooglePlacesService = {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (
      result: {
        name?: string
        formatted_address?: string
        geometry?: { location?: { lat: () => number; lng: () => number } }
      } | null,
    ) => void,
  ) => void
}

type GoogleMapsApi = {
  maps: {
    TravelMode?: { DRIVING: string }
    DirectionsService?: new () => {
      route: (
        request: {
          origin: { lat: number; lng: number }
          destination: { lat: number; lng: number }
          travelMode: string
          waypoints?: { location: { lat: number; lng: number } }[]
        },
        callback: (result: unknown, status: string) => void,
      ) => void
    }
    places: {
      AutocompleteService: new () => GoogleAutocompleteService
      PlacesService: new (attrContainer: HTMLElement) => GooglePlacesService
    }
  }
}

declare global {
  interface Window {
    google?: GoogleMapsApi
  }
}

let loadPromise: Promise<GoogleMapsApi | null> | null = null

export function googleMapsKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
}

export function loadGoogleMaps(): Promise<GoogleMapsApi | null> {
  const key = googleMapsKey()
  if (!key) return Promise.resolve(null)
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (!loadPromise) {
    loadPromise = new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&language=en`
      script.async = true
      script.onload = () => resolve(window.google ?? null)
      script.onerror = () => resolve(null)
      document.head.appendChild(script)
    })
  }
  return loadPromise
}

function googlePredict(api: GoogleMapsApi, query: string): Promise<Place[]> {
  return new Promise((resolve) => {
    const service = new api.maps.places.AutocompleteService()
    service.getPlacePredictions(
      { input: query, componentRestrictions: { country: 'tw' } },
      (predictions) => {
        const hits = (predictions ?? []).slice(0, 6).map((item) =>
          rememberPlace({
            id: item.place_id,
            name: item.description.split(',')[0] ?? item.description,
            address: item.description,
            lat: 0,
            lng: 0,
          }),
        )
        resolve(hits)
      },
    )
  })
}

export async function fillGooglePlace(id: string): Promise<Place | null> {
  const api = await loadGoogleMaps()
  if (!api) return null
  return new Promise((resolve) => {
    const host = document.createElement('div')
    const service = new api.maps.places.PlacesService(host)
    service.getDetails({ placeId: id, fields: ['name', 'formatted_address', 'geometry'] }, (result) => {
      const loc = result?.geometry?.location
      if (!loc) {
        resolve(null)
        return
      }
      resolve(
        rememberPlace({
          id,
          name: result.name ?? 'Place',
          address: result.formatted_address ?? '',
          lat: loc.lat(),
          lng: loc.lng(),
        }),
      )
    })
  })
}

async function nominatimSearch(query: string): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=tw&q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'Accept-Language': 'en' },
  })
  if (!response.ok) return []
  const rows = (await response.json()) as { place_id: number; display_name: string; lat: string; lon: string }[]
  return rows.map((row) =>
    rememberPlace({
      id: `osm-${row.place_id}`,
      name: row.display_name.split(',')[0]?.trim() ?? row.display_name,
      address: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }),
  )
}

export async function searchAddresses(query: string): Promise<Place[]> {
  const local = searchLocal(query)
  const trimmed = query.trim()
  if (trimmed.length < 2) return local.slice(0, 8)
  const api = await loadGoogleMaps()
  if (api) {
    const googleHits = await googlePredict(api, trimmed)
    return [...googleHits, ...local].slice(0, 8)
  }
  try {
    const remote = await nominatimSearch(trimmed)
    return [...local, ...remote].slice(0, 8)
  } catch {
    return local.slice(0, 8)
  }
}