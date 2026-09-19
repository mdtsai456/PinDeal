import type { StopKind } from './types'

export function stopMark(kind: StopKind): string {
  switch (kind) {
    case 'pickup':
    case 'peerPickup':
      return 'P'
    case 'dropoff':
    case 'peerDropoff':
      return 'D'
    case 'meet':
      return '•'
    case 'walkStart':
      return 'S'
    case 'walkEnd':
      return 'E'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function youBoardCopy(order: number): string {
  return `You board ${order}${ordinalSuffix(order)}.`
}

export function youAreNthRiderCopy(name: string, order: number): string {
  return `${name}, you are the ${order}${ordinalSuffix(order)} rider.`
}

export function walkToSharedPickupCopy(): string {
  return 'Walk to the shared pickup.'
}

function ordinalSuffix(order: number): string {
  const n = Math.abs(order) % 100
  const last = n % 10
  if (n >= 11 && n <= 13) return 'th'
  switch (last) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}
