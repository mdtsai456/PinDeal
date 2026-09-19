import { describe, expect, it } from 'vitest'
import { incidentLabel, logTone, priorityField, stopMark } from './labels'

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

describe('incidentLabel', () => {
  it('traffic is a highway jam', () => {
    expect(incidentLabel('traffic')).toBe('Highway jam +12 min')
  })

  it('join is a rider joining', () => {
    expect(incidentLabel('join')).toBe('Rider wants to join')
  })

  it('leave is a rider leaving', () => {
    expect(incidentLabel('leave')).toBe('A rider leaves')
  })
})

describe('priorityField', () => {
  it('time maps to arrival_time', () => {
    expect(priorityField('time')).toBe('arrival_time')
  })
})

describe('logTone', () => {
  it('reject uses log-reject', () => {
    expect(logTone('reject')).toBe('log-reject')
  })
})
