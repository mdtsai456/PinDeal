import { nearestOnLine, placeById } from './geo.ts'
import type { LatLng, RouteStop, StopKind } from './types.ts'

export type WalkFocusEnd = 'pickup' | 'dropoff'

// 把站點畫在地圖上。上車與下車貼齊車路。門點不貼齊。
export function bookingStopPoint(item: RouteStop, polyline: LatLng[]): LatLng {
  const place = placeById(item.placeId)
  switch (item.kind) {
    case 'meet':
    case 'peerPickup':
    case 'peerDropoff':
    case 'pickup':
    case 'dropoff':
      return nearestOnLine(place, polyline)
    case 'walkStart':
    case 'walkEnd':
      return { lat: place.lat, lng: place.lng }
    default: {
      const _exhaustive: never = item.kind
      return _exhaustive
    }
  }
}

// 放大一端步行：門到上車，或下車到門。
export function walkFocusPoints(stops: RouteStop[], polyline: LatLng[], end: WalkFocusEnd): LatLng[] {
  switch (end) {
    case 'pickup':
      return focusPoints(stops, polyline, ['walkStart', 'pickup'])
    case 'dropoff':
      return focusPoints(stops, polyline, ['dropoff', 'walkEnd'])
    default: {
      const _exhaustive: never = end
      return _exhaustive
    }
  }
}

function focusPoints(stops: RouteStop[], polyline: LatLng[], kinds: StopKind[]): LatLng[] {
  const points: LatLng[] = []
  kinds.forEach((kind) => {
    const stop = stops.find((item) => item.kind === kind)
    if (stop) points.push(bookingStopPoint(stop, polyline))
  })
  return points
}
