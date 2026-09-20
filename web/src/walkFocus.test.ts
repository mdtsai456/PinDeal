import { describe, expect, it } from 'vitest'
import { nearestOnLine, rememberPlace } from './geo'
import type { RouteStop } from './types'
import { walkFocusPoints } from './walkFocus'

function stop(kind: RouteStop['kind'], placeId: string): RouteStop {
  return { id: `${kind}-${placeId}`, kind, riderId: 'A', placeId, time: '', waitMin: 0 }
}

const line = [
  { lat: 24.8, lng: 120.97 },
  { lat: 24.805, lng: 120.975 },
  { lat: 24.81, lng: 120.98 },
]

const doorP = rememberPlace({
  id: 'walk-focus-door-p',
  name: 'Pickup door',
  address: '',
  lat: 24.799,
  lng: 120.968,
})
const board = rememberPlace({
  id: 'walk-focus-board',
  name: 'Board',
  address: '',
  lat: 24.801,
  lng: 120.972,
})
const alight = rememberPlace({
  id: 'walk-focus-alight',
  name: 'Alight',
  address: '',
  lat: 24.809,
  lng: 120.979,
})
const doorD = rememberPlace({
  id: 'walk-focus-door-d',
  name: 'Dropoff door',
  address: '',
  lat: 24.812,
  lng: 120.982,
})

const shareStops: RouteStop[] = [
  stop('walkStart', doorP.id),
  stop('pickup', board.id),
  stop('dropoff', alight.id),
  stop('walkEnd', doorD.id),
]

describe('walkFocusPoints', () => {
  it('pickup focus is the gray door and the snapped board', () => {
    expect(walkFocusPoints(shareStops, line, 'pickup')).toEqual([
      { lat: doorP.lat, lng: doorP.lng },
      nearestOnLine(board, line),
    ])
  })

  it('dropoff focus is the snapped alight and the gray door', () => {
    expect(walkFocusPoints(shareStops, line, 'dropoff')).toEqual([
      nearestOnLine(alight, line),
      { lat: doorD.lat, lng: doorD.lng },
    ])
  })

  it('pickup focus uses only the snapped pickup when there is no walk door', () => {
    expect(walkFocusPoints([stop('pickup', board.id), stop('dropoff', alight.id)], line, 'pickup')).toEqual([
      nearestOnLine(board, line),
    ])
  })

  it('dropoff focus is empty when the ride has no dropoff', () => {
    expect(walkFocusPoints([stop('pickup', board.id)], line, 'dropoff')).toEqual([])
  })
})
