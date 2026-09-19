import { describe, expect, it } from 'vitest'
import { walkToSharedPickupCopy, youAreNthRiderCopy, youBoardCopy } from './labels'

describe('youBoardCopy', () => {
  it('1 is You board 1st.', () => {
    expect(youBoardCopy(1)).toBe('You board 1st.')
  })

  it('2 is You board 2nd.', () => {
    expect(youBoardCopy(2)).toBe('You board 2nd.')
  })

  it('3 is You board 3rd.', () => {
    expect(youBoardCopy(3)).toBe('You board 3rd.')
  })

  it('4 is You board 4th.', () => {
    expect(youBoardCopy(4)).toBe('You board 4th.')
  })
})

describe('youAreNthRiderCopy', () => {
  it('Yu 第 2 位', () => {
    expect(youAreNthRiderCopy('Yu', 2)).toBe('Yu, you are the 2nd rider.')
  })

  it('Chiang 第 1 位', () => {
    expect(youAreNthRiderCopy('Chiang', 1)).toBe('Chiang, you are the 1st rider.')
  })
})

describe('walkToSharedPickupCopy', () => {
  it('tells the rider to walk to the shared pickup', () => {
    expect(walkToSharedPickupCopy()).toBe('Walk to the shared pickup.')
  })
})
