import { mkdirSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
  flushHold,
  isJoinMatchError,
  joinMatch,
  resetMatch,
} from './server/matchStore.ts'
import { findUserByUsername, openUsersDb, seedUsers } from './server/users.ts'
import type { MatchJoinBody } from './src/engine/routePage.ts'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function sendHtml(res: ServerResponse, html: string): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(html)
}

export function matchPlugin(apiKey: string): Plugin {
  return {
    name: 'match-api',
    configureServer(server) {
      // storage/ 在 repo 根目錄。不可放在 Vite public/。public/ 會被靜態送出。
      const storageDir = path.resolve(import.meta.dirname, '../storage')
      mkdirSync(storageDir, { recursive: true })
      const matchFile = path.join(storageDir, 'matches', 'current.json')
      mkdirSync(path.dirname(matchFile), { recursive: true })
      const db = openUsersDb(path.join(storageDir, 'users.sqlite'))
      seedUsers(db)

      server.middlewares.use('/api/login', (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        void (async () => {
          let username = ''
          try {
            const raw = await readBody(req)
            const payload = JSON.parse(raw || '{}') as { username?: unknown }
            username = typeof payload.username === 'string' ? payload.username : ''
          } catch {
            username = ''
          }

          const user = findUserByUsername(db, username)
          if (!user) {
            sendJson(res, 404, { error: 'unknown_user' })
            return
          }
          sendJson(res, 200, {
            id: user.id,
            username: user.username,
            riderId: user.riderId,
          })
        })()
      })

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url?.split('?')[0] ?? ''
        // 評審頁在 repo 根目錄。不可放進 web/public/。
        if ((url === '/agent-theater' || url === '/agent-theater/') && req.method === 'GET') {
          const htmlPath = path.resolve(import.meta.dirname, '../agent-theater/index.html')
          const html = readFileSync(htmlPath, 'utf8')
          void server
            .transformIndexHtml(url, html)
            .then((out) => sendHtml(res, out))
            .catch(() => sendHtml(res, html))
          return
        }
        if (url === '/api/match' && req.method === 'GET') {
          void flushHold(matchFile, { apiKey })
            .then((record) => sendJson(res, 200, record))
            .catch(() => sendJson(res, 500, { error: 'match_settle_failed' }))
          return
        }
        if (url === '/api/match/reset' && req.method === 'POST') {
          resetMatch(matchFile)
          sendJson(res, 200, { ok: true })
          return
        }
        if (url === '/api/match/join' && req.method === 'POST') {
          void (async () => {
            try {
              const raw = await readBody(req)
              const payload = JSON.parse(raw || '{}') as MatchJoinBody
              const record = await joinMatch(matchFile, payload, { apiKey })
              sendJson(res, 200, record)
            } catch (error) {
              if (isJoinMatchError(error)) {
                sendJson(res, 409, { error: error.error })
                return
              }
              sendJson(res, 400, { error: 'bad_request' })
            }
          })()
          return
        }
        next()
      })
    },
  }
}
