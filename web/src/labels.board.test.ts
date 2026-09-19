import { describe, expect, it } from 'vitest'
import { walkToSharedPickupCopy, youBoardCopy } from './labels'

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

describe('walkToSharedPickupCopy', () => {
  it('tells the rider to walk to the shared pickup', () => {
    expect(walkToSharedPickupCopy()).toBe('Walk to the shared pickup.')
  })
})
