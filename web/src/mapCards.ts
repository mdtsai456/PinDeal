export type CardSide = 'e' | 'w' | 'n' | 's'

export type Pt = {
  x: number
  y: number
}

export type Rect = {
  x: number
  y: number
  w: number
  h: number
}

export const CARD_W = 196
export const CARD_H = 44
export const CARD_GAP = 8
export const DOT_R = 9

export function preferredSides(from: Pt, toward: Pt): CardSide[] {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ['w', 'n', 's', 'e'] : ['e', 'n', 's', 'w']
  }
  return dy >= 0 ? ['n', 'w', 'e', 's'] : ['s', 'w', 'e', 'n']
}

export function cardRect(dot: Pt, side: CardSide): Rect {
  switch (side) {
    case 'e':
      return { x: dot.x + DOT_R + CARD_GAP, y: dot.y - CARD_H / 2, w: CARD_W, h: CARD_H }
    case 'w':
      return { x: dot.x - DOT_R - CARD_GAP - CARD_W, y: dot.y - CARD_H / 2, w: CARD_W, h: CARD_H }
    case 'n':
      return { x: dot.x - CARD_W / 2, y: dot.y - DOT_R - CARD_GAP - CARD_H, w: CARD_W, h: CARD_H }
    case 's':
      return { x: dot.x - CARD_W / 2, y: dot.y + DOT_R + CARD_GAP, w: CARD_W, h: CARD_H }
    default: {
      const _exhaustive: never = side
      return _exhaustive
    }
  }
}

export function pointInRect(point: Pt, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function hitsInRect(rect: Rect, points: Pt[]): number {
  return points.reduce((count, point) => count + (pointInRect(point, rect) ? 1 : 0), 0)
}

export function offMapPenalty(rect: Rect, size: Pt, pad = 8): number {
  let penalty = 0
  if (rect.x < pad) penalty += pad - rect.x
  if (rect.y < pad) penalty += pad - rect.y
  if (rect.x + rect.w > size.x - pad) penalty += rect.x + rect.w - (size.x - pad)
  if (rect.y + rect.h > size.y - pad) penalty += rect.y + rect.h - (size.y - pad)
  return penalty
}

export function sampleToward(points: Pt[], fromStart: boolean, fraction = 0.2): Pt {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]
  const last = points.length - 1
  const idx = fromStart
    ? Math.min(last, Math.max(1, Math.round(last * fraction)))
    : Math.max(0, Math.min(last - 1, Math.round(last * (1 - fraction))))
  return points[idx]
}

export function pointAlongPath(points: Pt[], fromStart: boolean, distPx = 56): Pt {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]
  if (fromStart) return walkPath(points, distPx)
  return walkPath(points.slice().reverse(), distPx)
}

function walkPath(points: Pt[], distPx: number): Pt {
  let acc = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    if (dist === 0) continue
    if (acc + dist >= distPx) {
      const t = (distPx - acc) / dist
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    acc += dist
  }
  return points[Math.min(1, points.length - 1)]
}

export function sampleLine(points: Pt[], step = 8): Pt[] {
  if (points.length === 0) return []
  const out: Pt[] = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(dist / step))
    for (let k = 1; k <= n; k += 1) {
      const t = k / n
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

export function pickCardSide(
  dot: Pt,
  toward: Pt,
  linePts: Pt[],
  mapSize: Pt,
  blocked: Rect[],
): CardSide {
  const order = preferredSides(dot, toward)
  let best = order[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const side of order) {
    const rect = cardRect(dot, side)
    const hits = hitsInRect(rect, linePts)
    const clip = offMapPenalty(rect, mapSize)
    const overlap = blocked.some((other) => rectsOverlap(rect, other)) ? 90 : 0
    const wide = side === 'n' || side === 's' ? 8 : 0
    const score = hits * 18 + clip + overlap + wide
    if (score < bestScore) {
      bestScore = score
      best = side
    }
  }
  return best
}

export function iconLayout(side: CardSide): { size: LPoint; anchor: LPoint } {
  switch (side) {
    case 'e':
      return { size: [220, 52], anchor: [9, 26] }
    case 'w':
      return { size: [220, 52], anchor: [211, 26] }
    case 'n':
      return { size: [220, 80], anchor: [110, 71] }
    case 's':
      return { size: [220, 80], anchor: [110, 9] }
    default: {
      const _exhaustive: never = side
      return _exhaustive
    }
  }
}

type LPoint = [number, number]
