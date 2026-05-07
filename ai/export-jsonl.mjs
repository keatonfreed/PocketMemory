import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataset as seedDataset } from './data/examples.seed.mjs'
import { exportJsonl, stripEditorOnlyFields, validateDataset } from './lib/format.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, 'data', 'examples.json')
const outDir = path.join(__dirname, 'exports')

function exportFilename(date = new Date()) {
  const stamp = date.toISOString()
    .replace(/T/, '-')
    .replace(/\..+$/, '')
    .replace(/:/g, '')
  return `query-memory.ft.${stamp}.jsonl`
}

async function loadDataset() {
  if (!existsSync(dataPath)) return stripEditorOnlyFields(seedDataset)
  return stripEditorOnlyFields(JSON.parse(await readFile(dataPath, 'utf8')))
}

const dataset = await loadDataset()
const validation = validateDataset(dataset)

if (validation.errors.length) {
  console.error('Dataset validation failed:')
  for (const error of validation.errors) console.error(`- ${error}`)
  process.exit(1)
}

const jsonl = exportJsonl(dataset)
await mkdir(outDir, { recursive: true })
const outPath = path.join(outDir, exportFilename())
await writeFile(outPath, `${jsonl}\n`)

console.log(`Wrote ${validation.approved} approved examples to ${outPath}`)
