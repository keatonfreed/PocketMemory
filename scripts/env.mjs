import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { parse } from 'dotenv'
const file = '.env.local'
const template = parse(fs.readFileSync('.env.example', 'utf8'))
const secrets = new Set(['DATABASE_URL', 'OPENAI_API_KEY', 'TYPESAFE_API_KEY', 'BETTER_AUTH_SECRET', 'APPLE_PRIVATE_KEY'])
const defaults = { ...template, BETTER_AUTH_URL: 'https://pocket-memory-ai.vercel.app', VITE_API_URL: 'https://pocket-memory-ai.vercel.app' }
const read = () => fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : {}
function save(values) {
  const contents = '# Pocket Memory — private local setup. Never commit this file.\n' + Object.entries(values).map(([key, value]) => `${key}="${String(value).replace(/\r/g, '').replace(/\n/g, '\\n')}"`).join('\n') + '\n'
  if (Object.values(values).some(value => String(value).includes('"'))) throw new Error('Double quotes inside values are unsupported; edit .env.local manually.')
  fs.writeFileSync(file + '.tmp', contents, { mode: 0o600 }); fs.renameSync(file + '.tmp', file); fs.chmodSync(file, 0o600)
}
function cli(args, input) {
  const result = spawnSync('vercel', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
  // Never echo CLI output from secret writes, even on error.
  if (result.error || result.status !== 0) throw new Error(`Vercel command failed: ${args.slice(0, 3).join(' ')}. Run vercel login / vercel project inspect to check access. No secret values printed.`)
  return result.stdout
}
function verifyLink() {
  const linked = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'))
  if (linked.projectName !== 'pocket-memory') throw new Error('Expected linked project pocket-memory; verify the project before syncing.')
  cli(['project', 'inspect', '--non-interactive'])
  console.log(`Verified CLI access to ${linked.projectName} (${linked.projectId}).`)
}
try {
  const [command = 'prepare', argument] = process.argv.slice(2)
  if (command === 'prepare') {
    const values = read()
    for (const [key, value] of Object.entries(defaults)) if (!values[key]) values[key] = value
    save(values)
    console.log('Added missing configuration names/defaults; existing values preserved. No keys generated.')
  } else if (command === 'secret') {
    const values = read()
    if (values.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET already exists. It was not rotated.')
    values.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url'); save(values)
    console.log('Generated and saved Better Auth signing/encryption secret locally. Value not printed.')
  } else if (command === 'apple-key') {
    if (!argument || !argument.endsWith('.p8')) throw new Error('Pass the path to your downloaded .p8 file.')
    const key = fs.readFileSync(argument, 'utf8').trim()
    if (!key.startsWith('-----BEGIN PRIVATE KEY-----')) throw new Error('Expected an Apple P8 private key.')
    save({ ...read(), APPLE_PRIVATE_KEY: key }); console.log('Saved Apple key locally; value not printed.')
  } else if (command === 'push') {
    const environment = argument || 'production'
    if (!['production', 'preview', 'development'].includes(environment)) throw new Error('Use production, preview, or development.')
    verifyLink()
    const values = read()
    for (const key of Object.keys(template).filter(key => !['IOS_BUILD_NUMBER', 'DEV_ORIGINS'].includes(key))) {
      if (!values[key]?.trim()) { console.log(`Missing, skipped: ${key}`); continue }
      cli(['env', 'add', key, environment, '--force', '--yes', secrets.has(key) && environment !== 'development' ? '--sensitive' : '--no-sensitive', '--non-interactive'], values[key].replace(/\\n/g, '\n'))
      console.log(`Synced ${key} → ${environment}`)
    }
    console.log('Existing deployments are unchanged. Redeploy from current Git code after completing setup. Preview/development are not changed unless explicitly selected.')
  } else if (command === 'pull') {
    verifyLink()
    const target = '.env.vercel.local'
    cli(['env', 'pull', target, '--environment=production', '--yes', '--non-interactive'])
    try {
      const remote = parse(fs.readFileSync(target, 'utf8')), values = read()
      for (const key of Object.keys(template)) if (!secrets.has(key) && remote[key]?.trim()) values[key] = remote[key]
      save(values); console.log('Merged public/config values from production. Local secrets preserved: Vercel does not return sensitive production secrets.')
    } finally { fs.rmSync(target, { force: true }) }
  } else throw new Error('Use prepare, secret, apple-key <path.p8>, push [production|preview|development], or pull.')
} catch (error) { console.error(error.message); process.exitCode = 1 }
