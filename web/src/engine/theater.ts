import type { Username } from '../types.ts'
import type { Pitch, SurplusAxis } from './match.ts'

export function buildTheater(input: {
  username: Username
  pitch: Pitch
  outcome: 'share' | 'solo'
  finalWalkMin: number
  finalRideMin: number
  finalFare: number
}): string[] {
  void input.username
  const push = axisPhrase(input.pitch.axis)
  const give = axisPhrase(input.pitch.give)
  if (input.outcome === 'solo') {
    return [
      'A hard wall was hit, so this is a veto.',
      `I pushed ${push} and offered ${give}, but the shared plan still failed.`,
      'You take a solo taxi.',
      `Your fare is NT$${input.finalFare}.`,
    ]
  }
  return [
    'I scored this shared plan against your walls only.',
    `I pushed ${push} and offered ${give}.`,
    `Walk stays at ${input.finalWalkMin} min. Ride stays at ${input.finalRideMin} min.`,
    `Your fare is NT$${input.finalFare}.`,
  ]
}

function axisPhrase(axis: SurplusAxis): string {
  switch (axis) {
    case 'fare':
      return 'fare'
    case 'walk':
      return 'a shorter walk'
    case 'ride':
      return 'a shorter ride'
    case 'ontime':
      return 'on-time arrival'
    default: {
      const _exhaustive: never = axis
      return _exhaustive
    }
  }
}
