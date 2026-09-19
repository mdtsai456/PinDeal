import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findUserByUsername, openUsersDb, seedUsers } from './users.ts'

describe('seedUsers', () => {
  let dir: string
  let db: ReturnType<typeof openUsersDb>

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sharemeter-users-'))
    db = openUsersDb(path.join(dir, 'users.sqlite'))
    seedUsers(db)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('seeds four usernames with canonical casing', () => {
    const rows = db
      .prepare('SELECT username FROM users ORDER BY username')
      .all() as { username: string }[]
    expect(rows.map((row) => row.username)).toEqual(['Chiang', 'Lin', 'Yang', 'Yu'])
  })

  it('does not write the real storage database', () => {
    expect(db.name.includes(`${path.sep}storage${path.sep}users.sqlite`)).toBe(false)
    expect(path.basename(dir).startsWith('sharemeter-users-')).toBe(true)
  })
})

describe('findUserByUsername', () => {
  let dir: string
  let db: ReturnType<typeof openUsersDb>

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sharemeter-users-'))
    db = openUsersDb(path.join(dir, 'users.sqlite'))
    seedUsers(db)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('finds Yang from yang and keeps canonical casing', () => {
    const user = findUserByUsername(db, 'yang')
    expect(user).toEqual({
      id: expect.any(Number),
      username: 'Yang',
      riderId: 'D',
    })
  })

  it('maps Yu Lin Chiang Yang to A B C D', () => {
    expect(findUserByUsername(db, 'yu')?.riderId).toBe('A')
    expect(findUserByUsername(db, 'LIN')?.riderId).toBe('B')
    expect(findUserByUsername(db, 'Chiang')?.riderId).toBe('C')
    expect(findUserByUsername(db, 'YANG')?.riderId).toBe('D')
  })

  it('returns null for an unknown username', () => {
    expect(findUserByUsername(db, 'Chen')).toBeNull()
  })
})
