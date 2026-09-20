import { describe, expect, it } from 'vitest'
import { cloneRider, PLACES } from './data'

describe('Yang defaults', () => {
  it('預設上車新竹車站、下車清大體育館', () => {
    const yang = cloneRider('D')
    expect(yang.originId).toBe('hsinchuStation')
    expect(yang.destinationId).toBe('nthuGym')
    expect(PLACES[yang.originId]?.name).toBe('Hsinchu Railway Station')
    expect(PLACES[yang.destinationId]?.name).toBe('NTHU Gymnasium')
  })
})
