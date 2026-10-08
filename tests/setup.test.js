import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parse } from 'dotenv'
import { PGlite } from '@electric-sql/pglite'
import { dropSql } from '../scripts/reset-database.mjs'
test('setup preserves secrets and imports multiline keys without printing values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-setup-'))
  try {
    fs.copyFileSync('.env.example', path.join(dir, '.env.example'))
    fs.writeFileSync(path.join(dir, '.env.local'), 'OPENAI_API_KEY="private-test-value"\n')
    const run = (...args) => spawnSync(process.execPath, [path.resolve('scripts/env.mjs'), ...args], { cwd: dir, encoding: 'utf8' })
    assert.equal(run('prepare').status, 0)
    assert.equal(parse(fs.readFileSync(path.join(dir, '.env.local'))).OPENAI_API_KEY, 'private-test-value')
    assert.equal(run('secret').status, 0); assert.equal(run('secret').status, 1)
    const key = '-----BEGIN PRIVATE KEY-----\ntest-only\n-----END PRIVATE KEY-----'
    const keyPath = path.join(dir, 'test.p8'); fs.writeFileSync(keyPath, key)
    const result = run('apple-key', keyPath)
    assert.equal(result.status, 0); assert.ok(!result.stdout.includes('test-only'))
    assert.equal(parse(fs.readFileSync(path.join(dir, '.env.local'))).APPLE_PRIVATE_KEY, key)
    assert.equal(fs.statSync(path.join(dir, '.env.local')).mode & 0o777, 0o600)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('reset refuses unrelated dependencies and preserves unrelated tables', async () => {
  const db = new PGlite(); await db.waitReady
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); CREATE TABLE unrelated (user_id text REFERENCES "user"(id));')
    await assert.rejects(db.exec(dropSql), /depend/)
    assert.equal((await db.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='user'")).rows[0].count, 1)
    await db.exec('DROP TABLE unrelated; CREATE TABLE unrelated (id text);'); await db.exec(dropSql)
    assert.equal((await db.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename='unrelated'")).rows[0].count, 1)
  } finally { await db.close() }
})
