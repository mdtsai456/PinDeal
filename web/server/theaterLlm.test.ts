import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTheater, rewriteMatchTheaters, rewriteTheater, type TheaterRewriteInput } from './theaterLlm.ts'

function inputOf(username: string, fallback: string[] = ['Keep walls.', 'No new pitch.', `Your fare is NT$1. ${username}`]): TheaterRewriteInput {
  return {
    username,
    systemPrompt: 'sys',
    userPrompt: `user ${username}`,
    fallback,
  }
}

function okResponse(theater: string[]) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ theater }) } }],
    }),
  }
}

describe('readTheater', () => {
  it('壞 JSON 回 null', () => {
    expect(readTheater('not-json')).toBeNull()
    expect(readTheater('{')).toBeNull()
  })

  it('2 行與 6 行回 null', () => {
    expect(readTheater(JSON.stringify({ theater: ['a', 'b'] }))).toBeNull()
    expect(readTheater(JSON.stringify({ theater: ['a', 'b', 'c', 'd', 'e', 'f'] }))).toBeNull()
  })

  it('3 到 5 行接受', () => {
    expect(readTheater(JSON.stringify({ theater: ['a', 'b', 'c'] }))).toEqual(['a', 'b', 'c'])
    expect(readTheater(JSON.stringify({ theater: ['a', 'b', 'c', 'd'] }))).toEqual(['a', 'b', 'c', 'd'])
    expect(readTheater(JSON.stringify({ theater: ['a', 'b', 'c', 'd', 'e'] }))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('rewriteTheater', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('逾時或失敗用 fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('timeout')),
    )
    const input = inputOf('Yu')
    await expect(rewriteTheater('key', input)).resolves.toEqual(input.fallback)
  })
})

describe('rewriteMatchTheaters', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('用 Promise.all 並行，失敗的人仍用自己的 fallback', async () => {
    const order: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { messages: { content: string }[] }
        const who = body.messages[1]?.content ?? ''
        order.push(`start:${who}`)
        if (who.includes('Lin')) {
          throw new Error('lin fail')
        }
        await new Promise((resolve) => setTimeout(resolve, 30))
        order.push(`end:${who}`)
        return okResponse(['Rewritten one.', 'Rewritten two.', 'Rewritten three.'])
      }),
    )

    const result = await rewriteMatchTheaters('key', [inputOf('Yu'), inputOf('Lin', ['Lin a', 'Lin b', 'Lin c'])])
    expect(result[0]).toEqual(['Rewritten one.', 'Rewritten two.', 'Rewritten three.'])
    expect(result[1]).toEqual(['Lin a', 'Lin b', 'Lin c'])
    expect(order[0]).toBe('start:user Yu')
    expect(order[1]).toBe('start:user Lin')
    expect(order.filter((item) => item.startsWith('start:'))).toHaveLength(2)
  })
})
