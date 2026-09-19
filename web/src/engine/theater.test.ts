import { describe, expect, it } from 'vitest'
import { buildTheater } from './theater'

describe('buildTheater', () => {
  const lines = buildTheater({
    username: 'Yu',
    pitch: { axis: 'ontime', give: 'fare', note: 'Keep this rider on time.' },
    outcome: 'share',
    finalWalkMin: 4,
    finalRideMin: 16,
    finalFare: 144,
  })

  it('產出 3 到 5 句英文', () => {
    expect(lines.length).toBeGreaterThanOrEqual(3)
    expect(lines.length).toBeLessThanOrEqual(5)
    expect(lines.every((line) => /[A-Za-z]/.test(line))).toBe(true)
  })

  it('Yu 的對白不含 Chiang／Lin／Yang', () => {
    const blob = lines.join(' ')
    expect(blob).not.toMatch(/Chiang|Lin|Yang/)
  })

  it('只有最後一行可有自己的 NT$', () => {
    const head = lines.slice(0, -1).join(' ')
    expect(head).not.toMatch(/NT\$/)
    expect(lines.at(-1)).toContain('NT$144')
    expect(lines.join(' ').match(/NT\$/g)).toEqual(['NT$'])
  })
})
