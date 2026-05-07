import { developerPromptTemplate, getDocumentTool, MODEL } from './pocket-memory-contract.mjs'

export function buildDocumentContext(documents = []) {
  if (!documents.length) return ''

  return documents.map((doc) => {
    const listType = doc.docMetadata?.listType || doc.listType
    const tags = doc.docTags || []
    const typeLabel = `${doc.docType}${listType ? ` - ${listType}` : ''}`
    const tagLabel = tags.length ? ` [${tags.join(', ')}]` : ''
    return `- \`[${doc.docId}] ${doc.docTitle}: ${doc.docSummary}\` (${typeLabel})${tagLabel}`
  }).join('\n')
}

export function renderDeveloperPrompt(example, promptTemplate = developerPromptTemplate) {
  return promptTemplate.replace('{{DOCUMENT_CONTEXT}}', buildDocumentContext(example.documents || []))
}

export function findDocument(example, docId) {
  return (example.documents || []).find((doc) => doc.docId === docId) || null
}

export function getExampleToolCalls(example) {
  const calls = Array.isArray(example.toolCalls) ? example.toolCalls.filter(Boolean) : (example.toolCall ? [example.toolCall] : [])
  return calls.map((call) => ({
    ...call,
    docIds: Array.isArray(call.docIds) ? call.docIds : (call.docId ? [call.docId] : []),
  }))
}

export function toAiListItem(item) {
  if (typeof item === 'string') {
    return {
      itemId: '',
      itemContent: item,
      itemCompleted: false,
    }
  }

  return {
    itemId: item?.itemId || item?.id || '',
    itemContent: item?.itemContent ?? item?.content ?? '',
    itemCompleted: Boolean(item?.itemCompleted ?? item?.completed ?? false),
  }
}

export function toAiDocContent(doc) {
  if (doc?.docType === 'list') return Array.isArray(doc.docContent) ? doc.docContent.map(toAiListItem) : []
  return doc?.docContent ?? ''
}

export function toolOutputForDocument(doc) {
  if (!doc) return { success: false, error: 'Document not found.' }

  return {
    success: true,
    document: {
      docId: doc.docId,
      docTitle: doc.docTitle,
      docSummary: doc.docSummary,
      docType: doc.docType,
      docTags: doc.docTags || [],
      docMetadata: doc.docMetadata || {},
      docContent: toAiDocContent(doc),
    },
  }
}

export function toolOutputForDocuments(docs) {
  const documents = docs.map(toolOutputForDocument)
    .filter((output) => output.success && output.document)
    .map((output) => output.document)

  return {
    success: documents.length > 0,
    documents,
    missingDocIds: [],
  }
}

export function exampleToMessages(example, promptTemplate = developerPromptTemplate) {
  const messages = [
    { role: 'developer', content: renderDeveloperPrompt(example, promptTemplate) },
    { role: 'user', content: example.user },
  ]

  for (const [index, toolCall] of getExampleToolCalls(example).entries()) {
    if (toolCall?.name !== 'get_docs') continue

    const callId = toolCall.callId || `call_${example.id.replace(/[^a-zA-Z0-9_]/g, '_')}_${index + 1}`
    messages.push({
      role: 'assistant',
      tool_calls: [{
        id: callId,
        type: 'function',
        function: {
          name: 'get_docs',
          arguments: JSON.stringify({ docIds: toolCall.docIds }),
        },
      }],
    })

    const toolOutput = toolOutputForDocuments(toolCall.docIds.map((docId) => findDocument(example, docId)).filter(Boolean))
    messages.push({
      role: 'tool',
      tool_call_id: callId,
      content: JSON.stringify(toolOutput),
    })
  }

  messages.push({
    role: 'assistant',
    content: JSON.stringify(example.final),
  })

  return messages
}

export function exampleToFineTuneLine(example, promptTemplate = developerPromptTemplate) {
  return {
    messages: exampleToMessages(example, promptTemplate),
    tools: [getDocumentTool],
    parallel_tool_calls: false,
  }
}

export function exportJsonl(dataset) {
  const promptTemplate = dataset.promptTemplate || developerPromptTemplate
  return (dataset.examples || [])
    .filter((example) => example.status === 'approved')
    .map((example) => JSON.stringify(exampleToFineTuneLine(example, promptTemplate)))
    .join('\n')
}

function hasString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function validateCreatePayload(payload, errors) {
  if (!payload) return
  if (!hasString(payload.docTitle)) errors.push('createDoc.docTitle must be a non-empty string')
  if (!hasString(payload.docSummary)) errors.push('createDoc.docSummary must be a non-empty string')
  if (!['note', 'list'].includes(payload.docType)) errors.push('createDoc.docType must be note or list')
  if (!Array.isArray(payload.docTags)) errors.push('createDoc.docTags must be an array')

  if (payload.docType === 'note' && typeof payload.docContent !== 'string') {
    errors.push('createDoc note docContent must be a string')
  }

  if (payload.docType === 'list') {
    if (!Array.isArray(payload.docContent)) errors.push('createDoc list docContent must be an array of strings')
    if (Array.isArray(payload.docContent) && payload.docContent.some((item) => typeof item !== 'string')) {
      errors.push('createDoc list docContent must not include generated item ids or objects')
    }
    if (!['normal', 'grocery'].includes(payload.docMetadata?.listType)) {
      errors.push('createDoc list docMetadata.listType must be normal or grocery')
    }
  }
}

function validateToolCall(example, toolCall, errors, seenDocIds) {
  if (toolCall.name !== 'get_docs') errors.push('Only get_docs tool calls are supported')
  if (!Array.isArray(toolCall.docIds) || toolCall.docIds.length === 0) errors.push('toolCall.docIds is required')
  for (const docId of toolCall.docIds || []) {
    if (seenDocIds.has(docId)) errors.push(`Duplicate get_docs docId: ${docId}`)
    seenDocIds.add(docId)
    if (!findDocument(example, docId)) errors.push(`toolCall docId not found in documents: ${docId}`)
  }
}

function validateToolOutput(example, toolCall, errors) {
  const output = toolOutputForDocuments((toolCall.docIds || []).map((docId) => findDocument(example, docId)).filter(Boolean))
  if (output.success !== true) {
    errors.push('toolCall docId must resolve to a tool output document')
    return []
  }
  if (!Array.isArray(output.documents) || output.documents.length === 0) {
    errors.push('toolOutput.documents is required')
    return []
  }
  for (const doc of output.documents) {
    if (!toolCall.docIds.includes(doc.docId)) errors.push('toolOutput document docId must be included in toolCall.docIds')
    if (!['note', 'list'].includes(doc.docType)) errors.push('toolOutput document docType must be note or list')
    if (doc.docType === 'list' && !Array.isArray(doc.docContent)) errors.push('list toolOutput document docContent must be an array')
    if (doc.docType === 'list' && Array.isArray(doc.docContent)) {
      for (const item of doc.docContent) {
        if (!hasString(item.itemId)) errors.push('list tool output items must include itemId')
        if (!hasString(item.itemContent)) errors.push('list tool output items must include itemContent')
        if (typeof item.itemCompleted !== 'boolean') errors.push('list tool output items must include itemCompleted boolean')
        if ('id' in item || 'content' in item || 'completed' in item) {
          errors.push('list tool output items must use itemId/itemContent/itemCompleted, not id/content/completed')
        }
      }
    }
    if (doc.docType === 'note' && typeof doc.docContent !== 'string') errors.push('note toolOutput document docContent must be a string')
  }
  return output.documents
}

function findToolItem(toolDoc, itemId) {
  if (!toolDoc || !Array.isArray(toolDoc.docContent)) return null
  return toolDoc.docContent.find((item) => item.itemId === itemId)
}

function validateModification(action, toolDocsById, errors) {
  const payload = action.actionPayload
  if (!payload?.docId) errors.push('modifyDoc.actionPayload.docId is required')
  const toolDoc = payload?.docId ? toolDocsById.get(payload.docId) : null
  if (payload?.docId && !toolDoc) errors.push('modifyDoc docId must have a matching get_docs tool call')
  if (!Array.isArray(payload?.mods) || payload.mods.length === 0) {
    errors.push('modifyDoc.mods must be a non-empty array')
    return
  }

  for (const mod of payload.mods) {
    if (!mod?.modType) errors.push('mod missing modType')
    if (!mod?.modPayload) errors.push(`${mod?.modType || 'mod'} missing modPayload`)

    if (mod.modType === 'addListItem') {
      if (toolDoc?.docType !== 'list') errors.push('addListItem requires a list tool output')
      if (!hasString(mod.modPayload?.itemContent)) errors.push('addListItem.itemContent must be a non-empty string')
      if (typeof mod.modPayload?.itemCompleted !== 'boolean') errors.push('addListItem.itemCompleted must be boolean')
    } else if (mod.modType === 'editListItem') {
      if (toolDoc?.docType !== 'list') errors.push('editListItem requires a list tool output')
      if (!hasString(mod.modPayload?.itemId)) errors.push('editListItem.itemId is required')
      if (mod.modPayload?.itemId && !findToolItem(toolDoc, mod.modPayload.itemId)) errors.push(`editListItem.itemId not found in tool output: ${mod.modPayload.itemId}`)
      if (!hasString(mod.modPayload?.itemContent)) errors.push('editListItem.itemContent must be a non-empty string')
      if (typeof mod.modPayload?.itemCompleted !== 'boolean') errors.push('editListItem.itemCompleted must be boolean')
    } else if (mod.modType === 'deleteListItem') {
      if (toolDoc?.docType !== 'list') errors.push('deleteListItem requires a list tool output')
      if (!hasString(mod.modPayload?.itemId)) errors.push('deleteListItem.itemId is required')
      if (mod.modPayload?.itemId && !findToolItem(toolDoc, mod.modPayload.itemId)) errors.push(`deleteListItem.itemId not found in tool output: ${mod.modPayload.itemId}`)
    } else if (mod.modType === 'editNote') {
      if (toolDoc?.docType !== 'note') errors.push('editNote requires a note tool output')
      if (typeof mod.modPayload?.docContent !== 'string') errors.push('editNote.docContent must be a string')
    } else {
      errors.push(`Unknown mod type: ${mod.modType}`)
    }
  }
}

export function validateExample(example) {
  const errors = []

  if (!example.id) errors.push('Missing id')
  if (!example.user) errors.push('Missing user message')
  if (!Array.isArray(example.documents)) errors.push('documents must be an array')
  if (!example.final?.actions || !Array.isArray(example.final.actions)) errors.push('final.actions must be an array')
  const actions = Array.isArray(example.final?.actions) ? example.final.actions : []

  const toolCalls = getExampleToolCalls(example)
  const seenDocIds = new Set()
  const toolDocsById = new Map()

  for (const toolCall of toolCalls) {
    validateToolCall(example, toolCall, errors, seenDocIds)
    const toolDocs = validateToolOutput(example, toolCall, errors)
    for (const toolDoc of toolDocs) {
      if (toolDoc?.docId) toolDocsById.set(toolDoc.docId, toolDoc)
    }
  }

  for (const action of actions) {
    if (!action.actionType) errors.push('Action missing actionType')
    if (!action.actionPayload) errors.push(`Action ${action.actionType} missing actionPayload`)

    if (action.actionType === 'modifyDoc' && toolCalls.length === 0) {
      errors.push('modifyDoc examples must include one get_docs toolCall')
    }

    if (action.actionType === 'createDoc') validateCreatePayload(action.actionPayload, errors)
    else if (action.actionType === 'modifyDoc') validateModification(action, toolDocsById, errors)
    else if (['openDoc', 'deleteDoc'].includes(action.actionType)) {
      if (!action.actionPayload?.docId) errors.push(`${action.actionType}.actionPayload.docId is required`)
      if (action.actionPayload?.docId && !findDocument(example, action.actionPayload.docId)) {
        errors.push(`${action.actionType}.docId not found in documents: ${action.actionPayload.docId}`)
      }
    } else if (action.actionType) {
      errors.push(`Unknown actionType: ${action.actionType}`)
    }
  }

  return errors
}

export function validateDataset(dataset) {
  const examples = dataset.examples || []
  const seen = new Set()
  const results = examples.map((example) => {
    const errors = validateExample(example)
    if (seen.has(example.id)) errors.push(`Duplicate id: ${example.id}`)
    seen.add(example.id)
    return { id: example.id, status: example.status, errors }
  })

  return {
    model: dataset.model || MODEL,
    count: examples.length,
    approved: examples.filter((example) => example.status === 'approved').length,
    results,
    errors: results.flatMap((result) => result.errors.map((error) => `${result.id}: ${error}`)),
  }
}

export function stripEditorOnlyFields(dataset) {
  return {
    ...dataset,
    examples: (dataset.examples || []).map(({ notes, toolOutput, ...example }) => example),
  }
}
