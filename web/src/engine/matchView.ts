import { placeById } from '../geo'
import type { RiderDemand } from '../types'
import { riderCircles, type Circle } from './corridor'
import type { MatchRecord, MatchRider, Username } from './match'

export const THEATER_LINE_MS = 700

export type PayView = {
  title: string
  plan: string
  shareCount: number
  fare: number
}

export function ownRider(record: MatchRecord, username: Username): MatchRider | undefined {
  return record.riders.find((rider) => rider.username === username)
}

export function ownWalkCircles(
  record: MatchRecord | null,
  username: Username,
  you: Pick<RiderDemand, 'originId' | 'destinationId' | 'maxWalkMin'>,
): { origin: Circle; dest: Circle } {
  const me = record ? ownRider(record, username) : undefined
  if (me) {
    return { origin: me.routePage.originCircle, dest: me.routePage.destCircle }
  }
  return riderCircles(placeById(you.originId), placeById(you.destinationId), you.maxWalkMin)
}

export function isMatchReady(record: MatchRecord, username: Username): boolean {
  switch (record.status) {
    case 'collecting':
      return false
    case 'settled':
    case 'solo':
      return ownRider(record, username) != null
    default: {
      const _exhaustive: never = record.status
      return _exhaustive
    }
  }
}

export function canSkipToPay(record: MatchRecord | null, username: Username): boolean {
  if (!record) return false
  return isMatchReady(record, username)
}

export function ownTheater(record: MatchRecord, username: Username): string[] {
  return ownRider(record, username)?.theater ?? []
}

export function sharePaxCount(record: MatchRecord): number {
  return record.riders.filter((rider) => rider.outcome === 'share').length
}

export function ownFare(record: MatchRecord, username: Username): number | null {
  const me = ownRider(record, username)
  return me ? me.finalFare : null
}

export function planCopy(outcome: MatchRider['outcome']): string {
  switch (outcome) {
    case 'share':
      return 'Shared taxi plan. Meter split after pickup.'
    case 'solo':
      return 'Solo taxi'
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

export function payTitle(outcome: MatchRider['outcome']): string {
  switch (outcome) {
    case 'share':
      return 'Negotiation result'
    case 'solo':
      return 'Solo taxi'
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

export function payView(record: MatchRecord, username: Username): PayView | null {
  if (!isMatchReady(record, username)) return null
  const me = ownRider(record, username)
  if (!me) return null
  return {
    title: payTitle(me.outcome),
    plan: planCopy(me.outcome),
    shareCount: sharePaxCount(record),
    fare: me.finalFare,
  }
}

export function trackFare(
  record: MatchRecord | null,
  username: Username,
  fallbackFare: number,
): number {
  if (!record) return fallbackFare
  return payView(record, username)?.fare ?? fallbackFare
}

export function payVisibleText(view: PayView): string {
  return `${view.title} ${view.plan} ${view.shareCount} NT$${view.fare}`
}

export function keepOwnMatch(
  current: MatchRecord | null,
  incoming: MatchRecord,
  username: Username,
): MatchRecord {
  if (current?.status === 'collecting' && current.joins.some((join) => join.username === username)) {
    switch (incoming.status) {
      case 'collecting':
        return incoming
      case 'settled':
      case 'solo':
        return ownStopsMatchJoin(current, incoming, username) ? incoming : current
      default: {
        const _exhaustive: never = incoming.status
        return _exhaustive
      }
    }
  }
  if (current && isMatchReady(current, username)) return current
  return incoming
}

function ownStopsMatchJoin(
  current: MatchRecord,
  incoming: MatchRecord,
  username: Username,
): boolean {
  const join = current.joins.find((item) => item.username === username)
  const me = ownRider(incoming, username)
  if (!join || !me) return false
  return (
    join.routePage.pickup.id === me.routePage.pickup.id &&
    join.routePage.dropoff.id === me.routePage.dropoff.id
  )
}
