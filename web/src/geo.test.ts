import { describe, expect, it } from 'vitest'
import { bookingStops, interpolate, nearestOnLine, nearestPlace, placeById, searchLocal, userBookingView } from './geo'

describe('placeById', () => {
  it('returns Hsinchu Railway Station', () => {
    expect(placeById('hsinchuStation').name).toBe('Hsinchu Railway Station')
  })

  it('throws on an unknown id', () => {
    expect(() => placeById('nowhere')).toThrow('Unknown place: nowhere')
  })
})

describe('searchLocal', () => {
  it('matches each word in the query', () => {
    const hits = searchLocal('NTHU Gymnasium gym')
    expect(hits.some((place) => place.id === 'nthuGym')).toBe(true)
  })
})

describe('nearestPlace', () => {
  it('snaps to the nearest catalog place', () => {
    expect(nearestPlace(25.0479, 121.5171).id).toBe('taipeiMain')
  })
})

describe('userBookingView', () => {
  it('defaults to pickup and dropoff only', () => {
    const view = userBookingView('hsinchuStation', 'nthuGym')
    expect(view.stops.map((stop) => stop.kind)).toEqual(['pickup', 'dropoff'])
    expect(view.polyline).toHaveLength(2)
    expect(view.vias).toEqual([])
  })

  it('adds gray via stops when viaCount is 3', () => {
    const view = userBookingView('hsinchuStation', 'nthuGym', 3)
    expect(view.stops[0]?.kind).toBe('pickup')
    expect(view.stops.at(-1)?.kind).toBe('dropoff')
    expect(view.stops.filter((stop) => stop.kind === 'meet')).toHaveLength(3)
    expect(bookingStops(view.origin, view.dest, view.vias)).toHaveLength(5)
    expect(view.polyline.length).toBe(5)
  })

  it('pre-match route is pickup to dropoff only', () => {
    const view = userBookingView('hsinchuStation', 'nthuGym', 0)
    expect(view.stops.map((stop) => stop.kind)).toEqual(['pickup', 'dropoff'])
    expect(view.polyline).toHaveLength(2)
  })
})

describe('nearestOnLine', () => {
  it('snaps to the closest vertex', () => {
    const line = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
      { lat: 2, lng: 0 },
    ]
    expect(nearestOnLine({ lat: 1.1, lng: 0.4 }, line)).toEqual({ lat: 1, lng: 0 })
  })

  it('returns the point when the line is empty', () => {
    const point = { lat: 3, lng: 4 }
    expect(nearestOnLine(point, [])).toEqual(point)
  })
})

describe('interpolate', () => {
  const a = { lat: 0, lng: 0 }
  const b = { lat: 10, lng: 10 }

  it('t=0 is the start', () => {
    expect(interpolate([a, b], 0)).toEqual(a)
  })

  it('t=1 is the end', () => {
    expect(interpolate([a, b], 1)).toEqual(b)
  })

  it('t=0.5 is the midpoint', () => {
    expect(interpolate([a, b], 0.5)).toEqual({ lat: 5, lng: 5 })
  })

  it('t below 0 clamps to 0', () => {
    expect(interpolate([a, b], -2)).toEqual(a)
  })

  it('t above 1 clamps to 1', () => {
    expect(interpolate([a, b], 3)).toEqual(b)
  })

  it('throws on an empty path', () => {
    expect(() => interpolate([], 0.5)).toThrow('Route has no coordinates')
  })

  it('returns the only point', () => {
    expect(interpolate([a], 0.8)).toEqual(a)
  })
})
