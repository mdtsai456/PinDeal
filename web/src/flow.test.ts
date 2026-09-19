import { describe, expect, it } from 'vitest'
import { STEP_META, stepFromPath } from './flow'

describe('stepFromPath', () => {
  it('讀取路徑最後一段', () => {
    expect(stepFromPath('/ride/parse')).toBe('parse')
    expect(stepFromPath('/ride/routes')).toBe('routes')
    expect(stepFromPath('/ride/negotiate')).toBe('negotiate')
    expect(stepFromPath('/ride/pay')).toBe('pay')
    expect(stepFromPath('/ride/track')).toBe('track')
    expect(stepFromPath('/ride/demand')).toBe('demand')
  })

  it('未知路徑回傳 demand', () => {
    expect(stepFromPath('/')).toBe('demand')
    expect(stepFromPath('/prefs')).toBe('demand')
  })
})

describe('STEP_META', () => {
  it('有 6 步且編號由 1 到 6', () => {
    expect(STEP_META.map((step) => step.n)).toEqual(['1', '2', '3', '4', '5', '6'])
  })
})