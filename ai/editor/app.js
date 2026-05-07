let dataset = null
let validation = null
let selectedId = null
let dirty = false
let autosaveTimer = null
let lastEditorError = ''

const el = (id) => document.getElementById(id)
const status = el('status')

const fields = {
  title: el('titleInput'),
  category: el('categoryInput'),
  status: el('exampleStatus'),
  toolCall: el('toolCallInput'),
  user: el('userInput'),
  documents: el('documentsInput'),
  final: el('finalInput'),
  prompt: el('promptInput'),
}

function selectedExample() {
  return dataset.examples.find((example) => example.id === selectedId)
}

function markDirty() {
  dirty = true
  lastEditorError = ''
  queueAutosave()
  updateStatus()
}

function updateStatus(extra = '') {
  if (!dataset) return
  const approved = dataset.examples.filter((example) => example.status === 'approved').length
  const selected = selectedExample()
  const errorCount = validation?.errors?.length || 0
  const saveBtn = el('saveBtn')
  saveBtn.classList.toggle('dirty', dirty && !lastEditorError)
  saveBtn.classList.toggle('invalid', Boolean(lastEditorError))
  saveBtn.textContent = lastEditorError ? 'Fix JSON before saving' : dirty ? 'Unsaved - Save now' : 'Saved'

  status.textContent = `${dataset.examples.length} examples, ${approved} approved, ${errorCount} validation errors${dirty ? ' - unsaved changes autosave' : ''}${lastEditorError ? ` - ${lastEditorError}` : ''}${extra ? ` - ${extra}` : ''}`
}

function fileNameFromPath(filePath = '') {
  return String(filePath).split(/[\\/]/).pop() || filePath
}

function parseJsonField(field, label) {
  field.classList.remove('invalid')
  try {
    return JSON.parse(field.value)
  } catch (error) {
    field.classList.add('invalid')
    throw new Error(`${label} is invalid JSON: ${error.message}`)
  }
}

function writeCurrentFromFields() {
  const example = selectedExample()
  if (!example) return
  Object.values(fields).forEach((field) => field.classList?.remove('invalid'))

  example.title = fields.title.value
  example.category = fields.category.value
  example.status = fields.status.value
  example.user = fields.user.value
  example.documents = parseJsonField(fields.documents, 'Documents JSON')
  example.final = parseJsonField(fields.final, 'Final output JSON')
  const parsedToolCalls = parseJsonField(fields.toolCall, 'Tool call JSON')
  if (Array.isArray(parsedToolCalls)) {
    example.toolCalls = parsedToolCalls
    delete example.toolCall
  } else {
    example.toolCall = parsedToolCalls
    delete example.toolCalls
  }
  delete example.toolOutput

  dataset.promptTemplate = fields.prompt.value
}

function tryWriteCurrentFromFields() {
  try {
    writeCurrentFromFields()
    lastEditorError = ''
    return true
  } catch (error) {
    lastEditorError = error.message
    updateStatus()
    return false
  }
}

function renderList() {
  const search = el('search').value.trim().toLowerCase()
  const statusFilter = el('statusFilter').value
  const list = el('exampleList')
  list.innerHTML = ''

  dataset.examples
    .filter((example) => {
      if (statusFilter === 'all' && example.status === 'rejected') return false
      if (statusFilter !== 'all' && example.status !== statusFilter) return false
      if (!search) return true
      return [example.id, example.title, example.category, example.user].join(' ').toLowerCase().includes(search)
    })
    .forEach((example) => {
      const button = document.createElement('article')
      button.className = `example-item${example.id === selectedId ? ' active' : ''}`
      button.innerHTML = `
        <strong>${example.title || example.id}</strong>
        <div class="meta">
          <span class="pill ${example.status}">${example.status}</span>
          <span class="pill">${example.category || 'uncategorized'}</span>
          <span class="pill">${Array.isArray(example.toolCalls) ? `${example.toolCalls.length} tools` : example.toolCall ? 'tool' : 'no tool'}</span>
          <span class="pill">${example.documents?.length || 0} docs</span>
          <button class="quick-toggle ${example.status}" type="button">${example.status === 'approved' ? 'Draft' : 'Approve'}</button>
        </div>
      `
      button.addEventListener('click', () => {
        if (!tryWriteCurrentFromFields()) return
        selectedId = example.id
        renderEditor()
        renderList()
      })
      button.querySelector('.quick-toggle').addEventListener('click', (event) => {
        event.stopPropagation()
        if (!tryWriteCurrentFromFields()) return
        example.status = example.status === 'approved' ? 'draft' : 'approved'
        if (example.id === selectedId) renderEditor()
        markDirty()
        renderList()
      })
      list.appendChild(button)
    })

  scrollSelectedIntoView()
}

function scrollSelectedIntoView() {
  window.requestAnimationFrame(() => {
    const active = document.querySelector('.example-item.active')
    active?.scrollIntoView({ block: 'center' })
  })
}

function renderStatusToggle() {
  const statusToggle = el('statusToggleBtn')
  const label = fields.status.value === 'approved' ? 'Approved' : fields.status.value === 'rejected' ? 'Rejected' : 'Draft'
  statusToggle.textContent = label
  statusToggle.classList.toggle('approved', fields.status.value === 'approved')
  statusToggle.classList.toggle('rejected', fields.status.value === 'rejected')
  statusToggle.classList.toggle('draft', fields.status.value === 'draft')
  el('rejectSelectedBtn').textContent = fields.status.value === 'rejected' ? 'Move to Draft' : 'Reject'
}

function renderEditor() {
  const example = selectedExample()
  if (!example) return

  fields.title.value = example.title || ''
  fields.category.value = example.category || ''
  fields.status.value = example.status || 'draft'
  renderStatusToggle()
  fields.toolCall.value = JSON.stringify(example.toolCalls || example.toolCall || null, null, 2)
  fields.user.value = example.user || ''
  fields.documents.value = JSON.stringify(example.documents || [], null, 2)
  fields.final.value = JSON.stringify(example.final || { actions: [] }, null, 2)
  fields.prompt.value = dataset.promptTemplate || ''
  lastEditorError = ''
  updateStatus()
}

async function load() {
  const response = await fetch('/api/dataset')
  const payload = await response.json()
  dataset = payload.dataset
  validation = payload.validation
  selectedId = dataset.examples.find((example) => example.status === 'draft')?.id || dataset.examples.find((example) => example.status !== 'rejected')?.id || dataset.examples[0]?.id || null
  dirty = false
  renderList()
  renderEditor()
  updateStatus(payload.usingSeed ? 'using seed data until first save' : '')
}

async function save() {
  if (!tryWriteCurrentFromFields()) return false
  const response = await fetch('/api/dataset', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dataset),
  })
  const payload = await response.json()
  validation = payload.validation
  dirty = false
  renderList()
  updateStatus('saved')
  return true
}

async function validate() {
  if (!tryWriteCurrentFromFields()) return
  const response = await fetch('/api/dataset', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dataset),
  })
  const payload = await response.json()
  validation = payload.validation
  dirty = false
  renderList()
  updateStatus(validation.errors.length ? validation.errors[0] : 'valid')
}

async function exportJsonl() {
  const saved = await save()
  if (!saved) return
  const response = await fetch('/api/export', { method: 'POST' })
  const payload = await response.json()
  validation = payload.validation || validation
  if (!payload.ok) {
    updateStatus('export blocked by validation errors')
    return
  }
  updateStatus(`exported ${payload.approved} as ${fileNameFromPath(payload.path)}`)
}

async function previewLine() {
  if (!tryWriteCurrentFromFields()) return
  const example = selectedExample()
  if (!example) return
  const response = await fetch('/api/preview-line', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ example, promptTemplate: dataset.promptTemplate }),
  })
  el('previewOutput').textContent = JSON.stringify(await response.json(), null, 2)
}

function queueAutosave() {
  window.clearTimeout(autosaveTimer)
  autosaveTimer = window.setTimeout(async () => {
    if (!dirty) return
    await save()
  }, 1800)
}

for (const input of Object.values(fields)) {
  input.addEventListener('input', markDirty)
}

window.addEventListener('beforeunload', (event) => {
  if (!dirty && !lastEditorError) return
  event.preventDefault()
  event.returnValue = ''
})

el('search').addEventListener('input', renderList)
el('statusFilter').addEventListener('change', renderList)
el('saveBtn').addEventListener('click', save)
el('validateBtn').addEventListener('click', validate)
el('exportBtn').addEventListener('click', exportJsonl)
el('nextDraftBtn').addEventListener('click', () => {
  if (!tryWriteCurrentFromFields()) return
  const currentIndex = dataset.examples.findIndex((example) => example.id === selectedId)
  const ordered = [...dataset.examples.slice(currentIndex + 1), ...dataset.examples.slice(0, currentIndex + 1)]
  const nextDraft = ordered.find((example) => example.status === 'draft')
  if (!nextDraft) {
    updateStatus('no drafts left')
    return
  }
  selectedId = nextDraft.id
  renderEditor()
  renderList()
})
el('statusToggleBtn').addEventListener('click', () => {
  fields.status.value = fields.status.value === 'approved' ? 'draft' : 'approved'
  renderStatusToggle()
  markDirty()
  renderList()
})
el('rejectSelectedBtn').addEventListener('click', () => {
  fields.status.value = fields.status.value === 'rejected' ? 'draft' : 'rejected'
  renderStatusToggle()
  markDirty()
  renderList()
})

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', async () => {
    for (const node of document.querySelectorAll('.tab')) node.classList.remove('active')
    for (const panel of document.querySelectorAll('.panel')) panel.classList.remove('active')
    tab.classList.add('active')
    el(`${tab.dataset.tab}Panel`).classList.add('active')
    if (tab.dataset.tab === 'preview') await previewLine()
  })
}

await load()
