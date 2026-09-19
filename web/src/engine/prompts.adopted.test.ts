import { describe, expect, it } from 'vitest'
import {
  AGENT_SYSTEM_PROMPT,
  agentUserPromptAdopted,
} from './prompts'

describe('adopted theater prompt', () => {
  it('採用 v1 時只帶 final 數字，不含未用的 v2 車資，也不叫 Score offer v2', () => {
    const finalFare = 108
    const unusedV2Fare = 100
    const prompt = agentUserPromptAdopted({
      walkMin: 3,
      rideMin: 16,
      fare: finalFare,
      pitch: JSON.stringify({ axis: 'ontime', give: 'fare', note: 'Keep this rider on time.' }),
      outcome: 'share',
    })
    expect(prompt).toContain('Rewrite theater from the adopted offer')
    expect(prompt).toContain(`fare=${finalFare}`)
    expect(prompt).toContain('walkMin=3')
    expect(prompt).toContain('rideMin=16')
    expect(prompt).not.toContain(`fare=${unusedV2Fare}`)
    expect(prompt).not.toContain('Score offer v2')
    expect(prompt).not.toMatch(/offer v2/i)
    expect(AGENT_SYSTEM_PROMPT).toContain('You are one rider\'s agent')
  })
})
