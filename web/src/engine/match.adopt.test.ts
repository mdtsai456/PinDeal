import { describe, expect, it } from 'vitest'
import { adoptVersion, majorityNeeded } from './match'

describe('majorityNeeded', () => {
  it('1 到 4 人的門檻', () => {
    expect(majorityNeeded(1)).toBe(1)
    expect(majorityNeeded(2)).toBe(2)
    expect(majorityNeeded(3)).toBe(2)
    expect(majorityNeeded(4)).toBe(3)
  })
})

describe('adoptVersion', () => {
  it('scoreV2 等於 scoreV1 仍用 v1', () => {
    expect(adoptVersion([1, 1], [1, 1])).toBe('v1')
    expect(adoptVersion([2, 2, 2], [2, 2, 2])).toBe('v1')
  })
})
