import { describe, expect, it } from 'vitest'
import { resolveIncident } from './incidents'
import { JOIN_ROUTE, LEAVE_ROUTE, TRAFFIC_ROUTE } from './routes'

describe('resolveIncident', () => {
  it('traffic 改走 v3 且 A 車資 480', () => {
    const result = resolveIncident('traffic')
    expect(result.route.id).toBe(TRAFFIC_ROUTE.id)
    expect(result.route.fares.A).toBe(480)
    expect(result.headline).toBe('Highway jam. Route updated.')
  })

  it('join 維持四人方案', () => {
    const result = resolveIncident('join')
    expect(result.route.id).toBe(JOIN_ROUTE.id)
    expect(result.route.fares).toEqual(JOIN_ROUTE.fares)
  })

  it('leave 移除 C 的車資', () => {
    const result = resolveIncident('leave')
    expect(result.route.id).toBe(LEAVE_ROUTE.id)
    expect(result.route.fares.C).toBe(0)
    expect(result.log.some((event) => event.kind === 'consensus')).toBe(true)
  })
})