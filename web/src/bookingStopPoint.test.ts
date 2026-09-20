import { describe, expect, it } from 'vitest'
import { rememberPlace } from './geo'
import type { RouteStop } from './types'
import { bookingStopPoint } from './walkFocus'

function stop(kind: RouteStop['kind'], placeId: string): RouteStop {
  return { id: kind, kind, riderId: 'A', placeId, time: '', waitMin: 0 }
}

const line = [
  { lat: 24.8, lng: 120.97 },
  { lat: 24.81, lng: 120.98 },
]

describe('bookingStopPoint', () => {
  it('keeps the walk door off the road', () => {
    const door = rememberPlace({
      id: 'booking-stop-door',
      name: 'Door',
      address: '',
      lat: 24.802,
      lng: 120.969,
    })

    expect(bookingStopPoint(stop('walkStart', door.id), line)).toEqual({
      lat: door.lat,
      lng: door.lng,
    })
  })

  it('snaps pickup to the nearest road vertex', () => {
    const board = rememberPlace({
      id: 'booking-stop-board',
      name: 'Board',
      address: '',
      lat: 24.809,
      lng: 120.979,
    })

    expect(bookingStopPoint(stop('pickup', board.id), line)).toEqual(line[1])
  })
})
