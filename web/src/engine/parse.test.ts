import { describe, expect, it } from 'vitest'
import { cloneRider, POSTER_RIDERS } from '../data'
import { flagsFromText, parseDemand, parseDemands } from './parse'

describe('flagsFromText', () => {
  it('reads extra pay and accessibility', () => {
    expect(flagsFromText('可加價，需要無障礙')).toEqual({
      extraPay: true,
      accessibility: true,
      needTrunk: false,
      canMeet: false,
    })
  })

  it('reads trunk and meetup', () => {
    expect(flagsFromText('大行李要後車廂，可附近集合')).toMatchObject({
      needTrunk: true,
      canMeet: true,
    })
  })
})

describe('parseDemand', () => {
  it('uses form places and 21:40 for rider A', () => {
    const parsed = parseDemand(POSTER_RIDERS.A)
    expect(parsed.origin).toBe('Hsinchu Railway Station')
    expect(parsed.destination).toBe('NTHU Gymnasium')
    expect(parsed.latestArrival).toBe('21:40')
    expect(parsed.extraPay).toBe(true)
    expect(parsed.priority).toBe('time')
    expect(parsed.accessibility).toBe(false)
  })

  it('sets accessibility from text even if the form is off', () => {
    const parsed = parseDemand({
      ...POSTER_RIDERS.A,
      accessibility: false,
      rawText: 'I need a wheelchair accessible vehicle',
    })
    expect(parsed.accessibility).toBe(true)
  })

  it('counts two large bags as at least 2', () => {
    const parsed = parseDemand(POSTER_RIDERS.C)
    expect(parsed.luggage).toBe(2)
    expect(parsed.extras).toContain('Needs trunk')
  })
})

describe('parseDemands', () => {
  it('parses four riders without overwriting form places', () => {
    const parsed = parseDemands([
      cloneRider('A'),
      POSTER_RIDERS.B,
      POSTER_RIDERS.C,
      POSTER_RIDERS.D,
    ])
    expect(parsed.map((item) => item.riderId)).toEqual(['A', 'B', 'C', 'D'])
    expect(parsed[1]?.origin).toBe('Beida Road Market')
    expect(parsed[1]?.destination).toBe('NTHU Library')
  })
})
