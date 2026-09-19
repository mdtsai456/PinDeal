import { describe, expect, it } from 'vitest'
import { stopMark } from './labels'

describe('stopMark', () => {
  it('pickup is P', () => {
    expect(stopMark('pickup')).toBe('P')
  })

  it('dropoff is D', () => {
    expect(stopMark('dropoff')).toBe('D')
  })

  it('meet is a dot', () => {
    expect(stopMark('meet')).toBe('•')
  })

  it('peerPickup is P', () => {
    expect(stopMark('peerPickup')).toBe('P')
  })

  it('peerDropoff is D', () => {
    expect(stopMark('peerDropoff')).toBe('D')
  })

  it('walkStart is S', () => {
    expect(stopMark('walkStart')).toBe('S')
  })

  it('walkEnd is E', () => {
    expect(stopMark('walkEnd')).toBe('E')
  })
})
