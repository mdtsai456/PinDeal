import type { FlowStep } from './types'

export const STEP_META: { id: FlowStep; n: string; label: string }[] = [
  { id: 'demand', n: '1', label: 'Trip details' },
  { id: 'parse', n: '2', label: 'Structure' },
  { id: 'routes', n: '3', label: 'Route data' },
  { id: 'negotiate', n: '4', label: 'Matching' },
  { id: 'pay', n: '5', label: 'Booking' },
  { id: 'track', n: '6', label: 'Live map' },
]

export function stepFromPath(pathname: string): FlowStep {
  const part = pathname.split('/').filter(Boolean).at(-1)
  switch (part) {
    case 'parse':
      return 'parse'
    case 'routes':
      return 'routes'
    case 'negotiate':
      return 'negotiate'
    case 'pay':
      return 'pay'
    case 'track':
      return 'track'
    default:
      return 'demand'
  }
}
