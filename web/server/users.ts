import Database from 'better-sqlite3'
import { USERNAME_TO_RIDER, USERNAMES, type Username } from '../src/engine/match.ts'
import type { RiderId } from '../src/types.ts'

export type SeedUsername = Username

export type UserRecord = {
  id: number
  username: Username
  riderId: RiderId
}

export type UsersDb = InstanceType<typeof Database>

export function openUsersDb(dbPath: string): UsersDb {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE
    )
  `)
  return db
}

export function seedUsers(db: UsersDb): void {
  const insert = db.prepare('INSERT OR IGNORE INTO users (username) VALUES (?)')
  const seed = db.transaction(() => {
    for (const username of USERNAMES) {
      insert.run(username)
    }
  })
  seed()
}

export function findUserByUsername(db: UsersDb, raw: string): UserRecord | null {
  const row = db
    .prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE')
    .get(raw.trim()) as { id: number; username: string } | undefined
  if (!row) {
    return null
  }
  const username = asSeedUsername(row.username)
  if (!username) {
    return null
  }
  return {
    id: row.id,
    username,
    riderId: USERNAME_TO_RIDER[username],
  }
}

function asSeedUsername(value: string): SeedUsername | null {
  for (const username of USERNAMES) {
    if (username === value) {
      return username
    }
  }
  return null
}
