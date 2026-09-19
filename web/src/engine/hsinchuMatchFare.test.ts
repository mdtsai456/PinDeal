import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import { groupHasCommonIntersection, haversineKm } from './corridor'
import { hitsWall, runMatch, splitBySolo, usernameForRider, type MatchSeed } from './match'
import { snapshotRoutePage } from './routePage'
import { delaySecFromTrip, hsinchuMeter } from './taxiTariff'

function corridorSeed(
  id: 'A' | 'B',
  km: number,
  durationMin: number,
  extraTimeMin: number,
  maxWalkMin: number,
): MatchSeed {
  const demand = cloneRider(id)
  return {
    username: usernameForRider(id),
    demand,
    routePage: snapshotRoutePage({
      pickup: {
        id: demand.originId,
        name: demand.originId,
        address: '',
        lat: 24.8018,
        lng: 120.9717,
      },
      dropoff: {
        id: demand.destinationId,
        name: demand.destinationId,
        address: '',
        lat: 24.7956,
        lng: 120.9925,
      },
      soloDurationMin: durationMin,
      soloDistanceKm: km,
      extraTimeMin,
      maxWalkMin,
      bags: demand.luggageCount,
      accessible: demand.accessibility,
      extraPay: demand.extraPay,
      notes: demand.rawText,
    }),
  }
}

describe('hsinchu corridor fares', () => {
  it('Yu／Lin 獨乘用同一跳表，且不是 80+25*km', () => {
    const record = runMatch([
      corridorSeed('A', 3.2, 6, 20, 8),
      corridorSeed('B', 2.6, 5, 18, 10),
    ])
    const yu = record.riders.find((rider) => rider.username === 'Yu')
    const lin = record.riders.find((rider) => rider.username === 'Lin')
    const yuSolo = hsinchuMeter({
      distanceKm: 3.2,
      delaySec: delaySecFromTrip(3.2, 6),
    })
    const linSolo = hsinchuMeter({
      distanceKm: 2.6,
      delaySec: delaySecFromTrip(2.6, 5),
    })
    expect(yu?.v1.soloFare).toBe(yuSolo)
    expect(lin?.v1.soloFare).toBe(linSolo)
    expect(yu?.v1.soloFare).toBe(150)
    expect(lin?.v1.soloFare).toBe(135)
    expect(yu?.v1.soloFare).not.toBe(160)
    expect(lin?.v1.soloFare).not.toBe(145)
  })

  it('共乘總額仍是 0.72 倍獨乘和，且每人低於自己的獨乘', () => {
    const record = runMatch([
      corridorSeed('A', 3.2, 6, 20, 8),
      corridorSeed('B', 2.6, 5, 18, 10),
    ])
    const yu = record.riders.find((rider) => rider.username === 'Yu')
    const lin = record.riders.find((rider) => rider.username === 'Lin')
    const solos = [yu?.v1.soloFare ?? 0, lin?.v1.soloFare ?? 0]
    const totalMeter = Math.round(0.72 * (solos[0]! + solos[1]!))
    const split = splitBySolo(solos, totalMeter)
    expect(record.status).toBe('settled')
    expect(record.adopted).toBe('v1')
    expect(totalMeter).toBe(205)
    expect(yu?.finalFare).toBe(split[0])
    expect(lin?.finalFare).toBe(split[1])
    expect(yu?.finalFare).toBe(108)
    expect(lin?.finalFare).toBe(97)
    expect(yu?.finalFare).toBeLessThan(yu?.v1.soloFare ?? 0)
    expect(lin?.finalFare).toBeLessThan(lin?.v1.soloFare ?? 0)
  })

  it('圈仍相交但門較遠時，獨乘與共乘都比近距離走廊貴', () => {
    const yuP = { lat: 24.8018, lng: 120.9717 }
    const chiangP = { lat: 24.8018, lng: 120.9796 }
    const yuD = { lat: 24.7956, lng: 120.9925 }
    const chiangD = { lat: 24.7956, lng: 120.9998 }
    const yuKm = haversineKm(yuP, yuD)
    const chiangKm = haversineKm(chiangP, chiangD)
    const yuMin = Math.max(1, Math.round((yuKm / 28) * 60))
    const chiangMin = Math.max(1, Math.round((chiangKm / 28) * 60))
    const yu = cloneRider('A')
    const chiang = cloneRider('C')
    const record = runMatch([
      {
        username: 'Yu',
        demand: { ...yu, maxWalkMin: 8 },
        routePage: snapshotRoutePage({
          pickup: { id: 'yu-far-p', name: 'Yu door', address: '', ...yuP },
          dropoff: { id: 'yu-far-d', name: 'Yu dest', address: '', ...yuD },
          soloDurationMin: yuMin,
          soloDistanceKm: Number(yuKm.toFixed(1)),
          extraTimeMin: yu.maxDetourMin,
          maxWalkMin: 8,
          bags: yu.luggageCount,
          accessible: yu.accessibility,
          extraPay: yu.extraPay,
          notes: yu.rawText,
        }),
      },
      {
        username: 'Chiang',
        demand: { ...chiang, maxWalkMin: 8 },
        routePage: snapshotRoutePage({
          pickup: { id: 'chiang-far-p', name: 'Chiang door', address: '', ...chiangP },
          dropoff: { id: 'chiang-far-d', name: 'Chiang dest', address: '', ...chiangD },
          soloDurationMin: chiangMin,
          soloDistanceKm: Number(chiangKm.toFixed(1)),
          extraTimeMin: chiang.maxDetourMin,
          maxWalkMin: 8,
          bags: chiang.luggageCount,
          accessible: chiang.accessibility,
          extraPay: chiang.extraPay,
          notes: chiang.rawText,
        }),
      },
    ])
    const yuR = record.riders.find((rider) => rider.username === 'Yu')
    const chiangR = record.riders.find((rider) => rider.username === 'Chiang')
    expect(haversineKm(yuP, chiangP)).toBeGreaterThan(0.75)
    expect(groupHasCommonIntersection([yuR!.routePage.originCircle, chiangR!.routePage.originCircle])).toBe(true)
    expect(groupHasCommonIntersection([yuR!.routePage.destCircle, chiangR!.routePage.destCircle])).toBe(true)
    expect(record.status).toBe('settled')
    expect(yuR?.outcome).toBe('share')
    expect(chiangR?.outcome).toBe('share')
    expect(yuR?.finalWalkMin).toBeGreaterThanOrEqual(5)
    expect(chiangR?.finalWalkMin).toBeGreaterThanOrEqual(5)
    expect(yuR?.v1.soloFare).toBe(125)
    expect(chiangR?.v1.soloFare).toBe(125)
    expect(yuR?.finalFare).toBe(90)
    expect(chiangR?.finalFare).toBe(90)
    expect(yuR?.finalFare).toBeLessThan(yuR?.v1.soloFare ?? 0)
    expect(chiangR?.finalFare).toBeLessThan(chiangR?.v1.soloFare ?? 0)
  })

  it('牆用同一費率：fare === soloFare 仍撞牆', () => {
    const solo = hsinchuMeter({ distanceKm: 3.2, delaySec: delaySecFromTrip(3.2, 6) })
    expect(
      hitsWall(
        {
          walkMin: 4,
          rideMin: 10,
          fare: solo,
          soloFare: solo,
          soloRideMin: 6,
          accessible: true,
          luggageOk: true,
        },
        {
          maxWalkMin: 8,
          maxDetourMin: 20,
          accessibility: false,
          luggageCount: 1,
        },
      ),
    ).toBe(true)
  })
})
