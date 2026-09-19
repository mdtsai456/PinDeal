import { describe, expect, it } from 'vitest'
import { HOLD_IDLE_MS, holdExpired, holdRemainingMs, holdWaitCopy, holdWaitLine } from './hold'

const T0 = Date.parse('2026-09-20T00:00:00.000Z')
const AT = '2026-09-20T00:00:00.000Z'

describe('HOLD_IDLE_MS', () => {
  it('固定 15 秒', () => {
    expect(HOLD_IDLE_MS).toBe(15_000)
  })
})

describe('holdExpired', () => {
  it('joinCount 為 0 不到期', () => {
    expect(holdExpired(0, AT, T0 + 20_000)).toBe(false)
  })

  it('1 人在 14999ms 不到期', () => {
    expect(holdExpired(1, AT, T0 + 14_999)).toBe(false)
  })

  it('1 人在 15000ms 到期', () => {
    expect(holdExpired(1, AT, T0 + 15_000)).toBe(true)
  })

  it('2／3 人同樣在 15000ms 到期', () => {
    expect(holdExpired(2, AT, T0 + 15_000)).toBe(true)
    expect(holdExpired(3, AT, T0 + 15_000)).toBe(true)
  })

  it('4 人立刻到期', () => {
    expect(holdExpired(4, AT, T0)).toBe(true)
    expect(holdExpired(4, null, T0)).toBe(true)
  })

  it('1．．3 人且 lastJoinAt 為 null 不到期', () => {
    expect(holdExpired(1, null, T0 + 20_000)).toBe(false)
    expect(holdExpired(3, null, T0 + 20_000)).toBe(false)
  })
})

describe('holdRemainingMs', () => {
  it('joinCount 為 0 回 0', () => {
    expect(holdRemainingMs(0, AT, T0)).toBe(0)
  })

  it('1 人在 14999ms 剩 1ms', () => {
    expect(holdRemainingMs(1, AT, T0 + 14_999)).toBe(1)
  })

  it('到期後下限 0', () => {
    expect(holdRemainingMs(1, AT, T0 + 15_000)).toBe(0)
    expect(holdRemainingMs(2, AT, T0 + 20_000)).toBe(0)
  })

  it('4 人 remaining 為 0', () => {
    expect(holdRemainingMs(4, AT, T0)).toBe(0)
  })

  it('null lastJoinAt 回 0', () => {
    expect(holdRemainingMs(2, null, T0)).toBe(0)
  })
})

describe('holdWaitCopy', () => {
  it('1 人用獨乘句', () => {
    expect(holdWaitCopy(1, 15)).toBe('Solo taxi in 15s if no one joins.')
    expect(holdWaitCopy(0, 8)).toBe('Solo taxi in 8s if no one joins.')
  })

  it('2 人以上用配對句', () => {
    expect(holdWaitCopy(2, 12)).toBe('Match starts in 12s if no one else joins.')
    expect(holdWaitCopy(3, 1)).toBe('Match starts in 1s if no one else joins.')
  })
})

describe('holdWaitLine', () => {
  it('1 人用 ceil 秒數寫獨乘句', () => {
    expect(holdWaitLine(1, AT, T0 + 1)).toBe('Solo taxi in 15s if no one joins.')
  })

  it('2 人用 ceil 秒數寫配對句', () => {
    expect(holdWaitLine(2, AT, T0 + 3_000)).toBe('Match starts in 12s if no one else joins.')
  })
})
