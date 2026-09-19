import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import { placeById } from '../geo'
import { riderCircles } from './corridor'
import type { MatchRecord } from './match'
import { ownWalkCircles } from './matchView'

const you = cloneRider('A')
const fromYou = riderCircles(placeById(you.originId), placeById(you.destinationId), you.maxWalkMin)

describe('ownWalkCircles', () => {
  it('collecting 且 riders 為空時，用 you 的起迄與 Max walk', () => {
    const record = {
      id: 'current',
      status: 'collecting',
      adopted: 'solo',
      joins: [],
      riders: [],
      sharePlan: null,
      lastJoinAt: null,
    } as MatchRecord
    expect(ownWalkCircles(record, 'Yu', you)).toEqual(fromYou)
  })

  it('無 match 時用 you 的起迄與 Max walk', () => {
    const tight = { ...you, maxWalkMin: 3 }
    expect(ownWalkCircles(null, 'Yu', tight)).toEqual(
      riderCircles(placeById(tight.originId), placeById(tight.destinationId), 3),
    )
  })

  it('成交後用自己 routePage 的圈，不用 you 的備用值', () => {
    const mine = {
      origin: { lat: 24.9, lng: 121.0, radiusKm: 0.4 },
      dest: { lat: 24.7, lng: 121.1, radiusKm: 0.4 },
    }
    const record = {
      id: 'current',
      status: 'settled',
      adopted: 'v1',
      joins: [],
      riders: [
        {
          username: 'Yu',
          routePage: { originCircle: mine.origin, destCircle: mine.dest },
        },
      ],
      sharePlan: null,
      lastJoinAt: null,
    } as MatchRecord
    expect(ownWalkCircles(record, 'Yu', you)).toEqual(mine)
    expect(ownWalkCircles(record, 'Yu', you)).not.toEqual(fromYou)
  })
})
