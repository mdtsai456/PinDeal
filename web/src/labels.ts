import type { IncidentKind, NegotiationKind, Priority, StopKind } from './types'

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

export function incidentLabel(kind: IncidentKind): string {
  switch (kind) {
    case 'traffic':
      return 'Highway jam +12 min'
    case 'join':
      return 'Rider wants to join'
    case 'leave':
      return 'A rider leaves'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function priorityField(priority: Priority): string {
  switch (priority) {
    case 'time':
      return 'arrival_time'
    case 'price':
      return 'price'
    case 'comfort':
      return 'trunk_space'
    case 'direct':
      return 'direct'
    default: {
      const _exhaustive: never = priority
      return _exhaustive
    }
  }
}

export function logTone(kind: NegotiationKind): string {
  switch (kind) {
    case 'system':
      return 'log-system'
    case 'stance':
      return 'log-stance'
    case 'propose':
      return 'log-propose'
    case 'reject':
      return 'log-reject'
    case 'trade':
      return 'log-trade'
    case 'fare':
      return 'log-fare'
    case 'accept':
      return 'log-accept'
    case 'consensus':
      return 'log-consensus'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}
