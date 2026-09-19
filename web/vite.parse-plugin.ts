import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function flagsFromText(text: string) {
  return {
    extraPay: /多付|加價/.test(text),
    accessibility: /無障礙|輪椅/.test(text),
    needTrunk: /後車廂|大行李/.test(text),
    canMeet: /集合/.test(text),
  }
}

export function parsePlugin(apiKey: string): Plugin {
  return {
    name: 'parse-demand',
    configureServer(server) {
      server.middlewares.use('/api/parse', (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        void (async () => {
          const raw = await readBody(req)
          const payload = JSON.parse(raw || '{}') as {
            texts?: { id: string; text: string }[]
          }
          const texts = payload.texts ?? []
          const local = texts.map((item) => ({ id: item.id, ...flagsFromText(item.text) }))

          let results: { source: string; content?: string; local: typeof local } = {
            source: 'local',
            local,
          }

          if (apiKey) {
            try {
              const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'openrouter/auto',
                  messages: [
                    {
                      role: 'system',
                      content:
                        'Extract ride-share constraints to JSON array. Fields: id, origin, destination, latestArrival, maxWaitMin, extras. Traditional Chinese place names.',
                    },
                    {
                      role: 'user',
                      content: JSON.stringify(texts),
                    },
                  ],
                }),
              })
              const data = (await response.json()) as {
                choices?: { message?: { content?: string } }[]
              }
              results = {
                source: 'openrouter',
                content: data.choices?.[0]?.message?.content ?? '',
                local,
              }
            } catch {
              results = { source: 'local', local }
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(results))
        })()
      })
    },
  }
}