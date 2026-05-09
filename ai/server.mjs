import http from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataset as seedDataset } from './data/examples.seed.mjs'
import { assembledContractForExample, exampleToFineTuneLine, exportJsonl, stripEditorOnlyFields, validateDataset } from './lib/format.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, 'data', 'examples.json')
const editorDir = path.join(__dirname, 'editor')
const exportDir = path.join(__dirname, 'exports')
const publicDir = path.join(__dirname, '..', 'public')
const port = Number(process.env.PORT || 5174)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
}

async function loadDataset() {
  if (!existsSync(dataPath)) return stripEditorOnlyFields(seedDataset)
  return stripEditorOnlyFields(JSON.parse(await readFile(dataPath, 'utf8')))
}

async function saveDataset(dataset) {
  await mkdir(path.dirname(dataPath), { recursive: true })
  await writeFile(dataPath, `${JSON.stringify(stripEditorOnlyFields(dataset), null, 2)}\n`)
}

async function readRequestJson(req) {
  let body = ''
  for await (const chunk of req) body += chunk
  return JSON.parse(body || '{}')
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type })
  res.end(body)
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value, null, 2))
}

function exportFilename(date = new Date()) {
  const stamp = date.toISOString()
    .replace(/T/, '-')
    .replace(/\..+$/, '')
    .replace(/:/g, '')
  return `query-memory.ft.${stamp}.jsonl`
}

async function routeApi(req, res, url) {
  if (url.pathname === '/api/dataset' && req.method === 'GET') {
    const dataset = await loadDataset()
    return sendJson(res, 200, { dataset, validation: validateDataset(dataset), usingSeed: !existsSync(dataPath) })
  }

  if (url.pathname === '/api/dataset' && req.method === 'PUT') {
    const dataset = await readRequestJson(req)
    const validation = validateDataset(dataset)
    await saveDataset(dataset)
    return sendJson(res, 200, { ok: true, validation })
  }

  if (url.pathname === '/api/export' && req.method === 'POST') {
    const dataset = await loadDataset()
    const validation = validateDataset(dataset)
    if (validation.errors.length) return sendJson(res, 400, { ok: false, validation })

    const jsonl = exportJsonl(dataset)
    await mkdir(exportDir, { recursive: true })
    const exportPath = path.join(exportDir, exportFilename())
    await writeFile(exportPath, `${jsonl}\n`)
    return sendJson(res, 200, { ok: true, path: exportPath, approved: validation.approved, jsonlPreview: jsonl.split('\n').slice(0, 3).join('\n') })
  }

  if (url.pathname === '/api/preview-line' && req.method === 'POST') {
    const { example } = await readRequestJson(req)
    return sendJson(res, 200, exampleToFineTuneLine(example))
  }

  if (url.pathname === '/api/contract-preview' && req.method === 'POST') {
    const { example } = await readRequestJson(req)
    return sendJson(res, 200, assembledContractForExample(example))
  }

  return false
}

async function routeStatic(req, res, url) {
  if (url.pathname.startsWith('/public/')) {
    const publicPath = path.normalize(path.join(publicDir, url.pathname.replace(/^\/public\//, '')))
    if (!publicPath.startsWith(publicDir)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8')
    if (!existsSync(publicPath)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8')
    const ext = path.extname(publicPath)
    return send(res, 200, await readFile(publicPath), contentTypes[ext] || 'application/octet-stream')
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = path.normalize(path.join(editorDir, requested))

  if (!filePath.startsWith(editorDir)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8')
  if (!existsSync(filePath)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8')

  const ext = path.extname(filePath)
  const body = await readFile(filePath)
  send(res, 200, body, contentTypes[ext] || 'application/octet-stream')
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.pathname.startsWith('/api/')) {
      const handled = await routeApi(req, res, url)
      if (handled === false) sendJson(res, 404, { error: 'Not found' })
      return
    }

    await routeStatic(req, res, url)
  } catch (error) {
    console.error(error)
    sendJson(res, 500, { error: error.message })
  }
})

server.listen(port, () => {
  console.log(`PocketMemory AI dataset editor: http://localhost:${port}`)
})
