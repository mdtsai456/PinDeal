const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'openrouter/auto'
const TIMEOUT_MS = 8000

export type TheaterRewriteInput = {
  username: string
  systemPrompt: string
  userPrompt: string
  fallback: string[]
}

type OpenRouterChat = {
  choices?: { message?: { content?: string } }[]
}

function readTheater(content: string): string[] | null {
  const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  try {
    const parsed = JSON.parse(trimmed) as { theater?: unknown }
    if (!Array.isArray(parsed.theater)) return null
    const lines = parsed.theater.filter((line): line is string => typeof line === 'string')
    if (lines.length < 3 || lines.length > 5) return null
    return lines
  } catch {
    return null
  }
}

export async function rewriteTheater(apiKey: string, input: TheaterRewriteInput): Promise<string[]> {
  if (!apiKey) return input.fallback
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return input.fallback
    const data = (await response.json()) as OpenRouterChat
    const lines = readTheater(data.choices?.[0]?.message?.content ?? '')
    return lines ?? input.fallback
  } catch {
    return input.fallback
  }
}

export async function rewriteMatchTheaters(
  apiKey: string,
  riders: TheaterRewriteInput[],
): Promise<string[][]> {
  const next: string[][] = []
  for (const rider of riders) {
    next.push(await rewriteTheater(apiKey, rider))
  }
  return next
}
