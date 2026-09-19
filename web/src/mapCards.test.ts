import { describe, expect, it } from 'vitest'
import { cardRect, pickCardSide, pointAlongPath, preferredSides, sampleLine, sampleToward } from './mapCards'

describe('preferredSides', () => {
  it('puts the card opposite an eastbound route', () => {
    expect(preferredSides({ x: 0, y: 0 }, { x: 40, y: 2 })[0]).toBe('w')
  })

  it('puts the card opposite a southbound route', () => {
    expect(preferredSides({ x: 0, y: 0 }, { x: 1, y: 40 })[0]).toBe('n')
  })
})

describe('pickCardSide', () => {
  it('avoids a side that covers the polyline', () => {
    const dot = { x: 220, y: 110 }
    const line = Array.from({ length: 20 }, (_, i) => ({ x: 230 + i * 8, y: 110 }))
    const side = pickCardSide(dot, { x: 300, y: 110 }, line, { x: 420, y: 240 }, [])
    expect(side).toBe('w')
  })

  it('falls back when the preferred side is off the map', () => {
    const dot = { x: 20, y: 80 }
    const line = Array.from({ length: 16 }, (_, i) => ({ x: 30 + i * 10, y: 80 }))
    const side = pickCardSide(dot, { x: 120, y: 80 }, line, { x: 360, y: 220 }, [])
    expect(['n', 's']).toContain(side)
  })
})

describe('cardRect', () => {
  it('places east cards to the right of the dot', () => {
    const rect = cardRect({ x: 100, y: 50 }, 'e')
    expect(rect.x).toBeGreaterThan(100)
  })
})

describe('sampleToward', () => {
  it('picks a point along the line from the start', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 50, y: 0 },
    ]
    expect(sampleToward(pts, true).x).toBeGreaterThan(0)
    expect(sampleToward(pts, false).x).toBeLessThan(50)
  })
})

describe('pointAlongPath', () => {
  it('walks a short distance from the start', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const point = pointAlongPath(pts, true, 40)
    expect(point.x).toBeCloseTo(40)
    expect(point.y).toBeCloseTo(0)
  })
})

describe('sampleLine', () => {
  it('fills in points along a long segment', () => {
    const pts = sampleLine(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      8,
    )
    expect(pts.length).toBeGreaterThan(2)
    expect(pts.at(-1)).toEqual({ x: 40, y: 0 })
  })
})
