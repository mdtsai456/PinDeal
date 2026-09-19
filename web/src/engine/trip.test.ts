import { describe, expect, it } from 'vitest'
import { CONSENSUS_ROUTE, TRAFFIC_ROUTE } from './routes'
import { initialTrip, tripReducer } from './trip'

describe('tripReducer', () => {
  it('初始你的車資是共識方案的 420', () => {
    expect(initialTrip().youFare).toBe(420)
    expect(initialTrip().you.id).toBe('A')
  })

  it('parse 產出 4 筆結構化需求', () => {
    const next = tripReducer(initialTrip(), { type: 'parse' })
    expect(next.structured).toHaveLength(4)
    expect(next.structured[0]?.origin).toBe('Hsinchu Railway Station')
  })

  it('traffic 事件把你的車資改成 480', () => {
    const jammed = tripReducer(initialTrip(), { type: 'incident', kind: 'traffic' })
    expect(jammed.youFare).toBe(480)
    expect(jammed.activeRoute.id).toBe(TRAFFIC_ROUTE.id)
    expect(jammed.incident?.kind).toBe('traffic')
  })

  it('reset 回到初始狀態', () => {
    const dirty = tripReducer(initialTrip(), { type: 'pay' })
    expect(dirty.paid).toBe(true)
    expect(tripReducer(dirty, { type: 'reset' })).toEqual(initialTrip())
  })

  it('pay 不改 youFare', () => {
    const next = tripReducer(initialTrip(), { type: 'pay' })
    expect(next.paid).toBe(true)
    expect(next.youFare).toBe(CONSENSUS_ROUTE.fares.A)
  })

  it('reset 保留目前的 you', () => {
    const dirty = tripReducer(initialTrip('B'), { type: 'pay' })
    expect(dirty.you.id).toBe('B')
    expect(dirty.paid).toBe(true)
    const next = tripReducer(dirty, { type: 'reset' })
    expect(next.you.id).toBe('B')
    expect(next.you.name).toBe('Lin')
    expect(next.paid).toBe(false)
    expect(next.youFare).toBe(CONSENSUS_ROUTE.fares.B)
  })

  it('setYou 讓 you 與車資跟登入名走', () => {
    const next = tripReducer(initialTrip(), {
      type: 'setYou',
      you: initialTrip('C').you,
    })
    expect(next.you.id).toBe('C')
    expect(next.you.name).toBe('Chiang')
    expect(next.youFare).toBe(CONSENSUS_ROUTE.fares.C)
  })
})
