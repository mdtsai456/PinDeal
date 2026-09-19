import { describe, expect, it } from 'vitest'
import {
  CONSENSUS_ROUTE,
  JOIN_ROUTE,
  LEAVE_ROUTE,
  REJECTED_ROUTE,
  TRAFFIC_ROUTE,
  fareSum,
} from './routes'

describe('fareSum', () => {
  it('共識方案四人車資合計 1200', () => {
    expect(CONSENSUS_ROUTE.fares).toEqual({ A: 420, B: 260, C: 280, D: 240 })
    expect(fareSum(CONSENSUS_ROUTE)).toBe(1200)
    expect(CONSENSUS_ROUTE.totalFare).toBe(1200)
  })

  it('否決方案合計仍 1200', () => {
    expect(fareSum(REJECTED_ROUTE)).toBe(1200)
  })

  it('塞車方案合計 1280', () => {
    expect(TRAFFIC_ROUTE.fares.A).toBe(480)
    expect(fareSum(TRAFFIC_ROUTE)).toBe(1280)
    expect(TRAFFIC_ROUTE.totalFare).toBe(1280)
  })

  it('C 退出後 C 車資為 0，合計 1080', () => {
    expect(LEAVE_ROUTE.fares.C).toBe(0)
    expect(fareSum(LEAVE_ROUTE)).toBe(1080)
    expect(LEAVE_ROUTE.totalFare).toBe(1080)
  })

  it('不加人時沿用共識車資', () => {
    expect(JOIN_ROUTE.fares).toEqual(CONSENSUS_ROUTE.fares)
  })
})

describe('CONSENSUS_ROUTE.stops', () => {
  it('時刻由早到晚', () => {
    const times = CONSENSUS_ROUTE.stops.map((stop) => stop.time)
    expect(times).toEqual(['07:00', '07:10', '07:15', '07:18', '07:28', '07:32', '07:40', '07:45'])
  })

  it('折線至少 2 點', () => {
    expect(CONSENSUS_ROUTE.polyline.length).toBeGreaterThan(1)
  })
})