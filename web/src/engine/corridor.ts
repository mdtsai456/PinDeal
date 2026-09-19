export const WALK_M_PER_MIN = 80

export type Circle = {
  lat: number
  lng: number
  radiusKm: number
}

const EARTH_KM = 6371
const TOUCH_EPS_KM = 1e-9

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function walkRadiusKm(maxWalkMin: number): number {
  return Math.max(0, maxWalkMin) * (WALK_M_PER_MIN / 1000)
}

export function riderCircles(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  maxWalkMin: number,
): { origin: Circle; dest: Circle } {
  const radiusKm = walkRadiusKm(maxWalkMin)
  return {
    origin: { lat: pickup.lat, lng: pickup.lng, radiusKm },
    dest: { lat: dropoff.lat, lng: dropoff.lng, radiusKm },
  }
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(x)))
}

export function circlesIntersect(a: Circle, b: Circle): boolean {
  return haversineKm(a, b) <= a.radiusKm + b.radiusKm + TOUCH_EPS_KM
}

export function groupHasCommonIntersection(circles: Circle[]): boolean {
  if (circles.length <= 1) return true
  if (circles.length === 2) {
    const first = circles[0]
    const second = circles[1]
    if (!first || !second) return true
    return circlesIntersect(first, second)
  }
  return circles.some((candidate) => pointInAllCircles(candidate, circles))
}

function pointInAllCircles(point: { lat: number; lng: number }, circles: Circle[]): boolean {
  return circles.every((circle) => haversineKm(point, circle) <= circle.radiusKm + TOUCH_EPS_KM)
}

// 交集內取一點。無人圈回 null。供成交地圖的集合上車／下車用。
export function commonMeetPoint(circles: Circle[]): { lat: number; lng: number } | null {
  if (circles.length === 0) return null
  const first = circles[0]
  if (!first) return null
  if (circles.length === 1) return { lat: first.lat, lng: first.lng }

  const mean = {
    lat: circles.reduce((sum, circle) => sum + circle.lat, 0) / circles.length,
    lng: circles.reduce((sum, circle) => sum + circle.lng, 0) / circles.length,
  }
  if (pointInAllCircles(mean, circles)) return mean

  const host = circles.find((circle) => pointInAllCircles(circle, circles))
  if (host) return { lat: host.lat, lng: host.lng }

  if (circles.length === 2) {
    const second = circles[1]
    if (!second) return null
    return twoCircleMeet(first, second)
  }
  return null
}

export type SpinePoint = {
  lat: number
  lng: number
  t: number
  tLine: number
}

// 把點投到線段上。超出端點時夾到端點。tLine 不夾，供沿軸排序。
export function projectOntoSegment(
  point: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): SpinePoint {
  const vx = b.lng - a.lng
  const vy = b.lat - a.lat
  const len2 = vx * vx + vy * vy
  if (len2 === 0) return { lat: a.lat, lng: a.lng, t: 0, tLine: 0 }
  const wx = point.lng - a.lng
  const wy = point.lat - a.lat
  const tLine = (wx * vx + wy * vy) / len2
  const t = Math.min(1, Math.max(0, tLine))
  return {
    lat: a.lat + vy * t,
    lng: a.lng + vx * t,
    t,
    tLine,
  }
}

// 圓外點沿圓心方向拉到邊界。圓內點不變。
export function clampToCircle(
  point: { lat: number; lng: number },
  circle: Circle,
): { lat: number; lng: number } {
  const dist = haversineKm(circle, point)
  if (dist <= circle.radiusKm + TOUCH_EPS_KM) return { lat: point.lat, lng: point.lng }
  if (dist < TOUCH_EPS_KM) return { lat: circle.lat, lng: circle.lng }
  const t = circle.radiusKm / dist
  return {
    lat: circle.lat + (point.lat - circle.lat) * t,
    lng: circle.lng + (point.lng - circle.lng) * t,
  }
}

// 先投到走廊軸，再夾進步行圓。此點是該人上車或下車。
export function personalMeetOnSpine(
  door: { lat: number; lng: number },
  circle: Circle,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): { lat: number; lng: number } {
  return clampToCircle(projectOntoSegment(door, a, b), circle)
}

function twoCircleMeet(a: Circle, b: Circle): { lat: number; lng: number } | null {
  if (!circlesIntersect(a, b)) return null
  const distance = haversineKm(a, b)
  if (distance < TOUCH_EPS_KM) return { lat: a.lat, lng: a.lng }
  const lo = Math.max(0, distance - b.radiusKm)
  const hi = Math.min(distance, a.radiusKm)
  if (lo > hi + TOUCH_EPS_KM) return null
  const t = (lo + hi) / 2 / distance
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  }
}
