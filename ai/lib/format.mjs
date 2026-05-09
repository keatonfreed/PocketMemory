import {
  MODEL,
  buildQueryMemoryContentStateMessage,
  buildQueryMemoryDeveloperPrompt,
  buildQueryMemoryDocumentContext,
  buildQueryMemoryIntentStateMessage,
  getDocumentTool,
  queryMemoryOutputSchema,
} from './pocket-memory-contract.mjs'

export function buildDocumentContext(documents = []) {
  return buildQueryMemoryDocumentContext(documents)
}

export function renderDeveloperPrompt(example) {
  return buildQueryMemoryDeveloperPrompt(example.documents || [])
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

export function getExampleDocRequests(example) {
  const requests = Array.isArray(example.needDocs)
    ? example.needDocs.filter(Boolean)
    : example.needDocs
      ? [example.needDocs]
      : getExampleToolCalls(example).map((call) => ({
        plan: call.plan || defaultNeedDocsPlan(example),
        docIds: call.docIds,
      }))

  return requests.map((request) => ({
    plan: String(request?.plan || defaultNeedDocsPlan(example)).slice(0, 200),
    docIds: [...new Set(Array.isArray(request?.docIds) ? request.docIds : [])],
  })).filter((request) => request.docIds.length)
}

export function defaultNeedDocsPlan(example) {
  const actions = Array.isArray(example.final?.actions) ? example.final.actions : []
  const docIds = [...new Set(actions
    .map((action) => action.actionPayload?.docId)
    .filter(Boolean))]
  const titles = docIds
    .map((docId) => findDocument(example, docId)?.docTitle)
    .filter(Boolean)
  const titleLabel = titles.length > 1
    ? titles.length <= 3 ? titles.join(', ') : `${titles.slice(0, 3).join(', ')}, and related docs`
    : titles[0] || 'the target document'

  if (actions.some((action) => action.actionType === 'modifyDoc')) {
    return `Read ${titleLabel} to preserve existing content and apply the requested edit.`
  }
  if (actions.some((action) => action.actionType === 'openDoc')) {
    return `Read ${titleLabel} to choose the correct document to open.`
  }
  return `Read ${titleLabel} to complete the request from existing content.`
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

export function docContentEnvelopeForDocuments(docs) {
  const docContentById = {}
  for (const doc of docs.filter(Boolean)) {
    docContentById[doc.docId] = {
      docId: doc.docId,
      docTitle: doc.docTitle,
      docSummary: doc.docSummary,
      docType: doc.docType,
      docTags: doc.docTags || [],
      docMetadata: doc.docMetadata || {},
      docContent: toAiDocContent(doc),
    }
  }

  return {
    fetchedDocIds: Object.keys(docContentById),
    docContentById,
  }
}

export function intentStateMessage() {
  return buildQueryMemoryIntentStateMessage()
}

export function contentStateMessage(envelope) {
  return buildQueryMemoryContentStateMessage(envelope)
}

export function finalResult(final) {
  return {
    resultType: 'final',
    plan: null,
    docIds: null,
    actions: Array.isArray(final?.actions) ? final.actions : [],
  }
}

export function exampleToMessages(example) {
  const messages = [
    { role: 'developer', content: renderDeveloperPrompt(example) },
    { role: 'developer', content: intentStateMessage() },
    { role: 'user', content: example.user },
  ]

  for (const request of getExampleDocRequests(example)) {
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ resultType: 'needDocs', plan: request.plan, docIds: request.docIds, actions: null }),
    })

    const envelope = docContentEnvelopeForDocuments(request.docIds.map((docId) => findDocument(example, docId)).filter(Boolean))
    messages.push({
      role: 'developer',
      content: contentStateMessage(envelope),
    })
  }

  messages.push({
    role: 'assistant',
    content: JSON.stringify(finalResult(example.final)),
  })

  return messages
}

export function exampleToFineTuneLine(example) {
  return {
    messages: exampleToMessages(example),
  }
}

export function exportJsonl(dataset) {
  return (dataset.examples || [])
    .filter((example) => example.status === 'approved')
    .map((example) => JSON.stringify(exampleToFineTuneLine(example)))
    .join('\n')
}

export function assembledContractForExample(example) {
  const docRequests = getExampleDocRequests(example)
  return {
    model: MODEL,
    developerPrompt: renderDeveloperPrompt(example),
    stateMessages: [
      intentStateMessage(),
      ...docRequests.map((request) => {
        const envelope = docContentEnvelopeForDocuments(request.docIds.map((docId) => findDocument(example, docId)).filter(Boolean))
        return contentStateMessage(envelope)
      }),
    ],
    toolDefinition: getDocumentTool,
    outputSchema: queryMemoryOutputSchema,
  }
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

function validateDocRequest(example, request, errors, seenDocIds) {
  if (!hasString(request.plan)) errors.push('needDocs.plan must be a non-empty string')
  if (request.plan && request.plan.length > 200) errors.push('needDocs.plan must be 200 chars or less')
  if (!Array.isArray(request.docIds) || request.docIds.length === 0) errors.push('needDocs.docIds is required')
  for (const docId of request.docIds || []) {
    if (seenDocIds.has(docId)) errors.push(`Duplicate needDocs docId: ${docId}`)
    seenDocIds.add(docId)
    if (!findDocument(example, docId)) errors.push(`needDocs docId not found in documents: ${docId}`)
  }
}

function contentDocsForRequest(example, request, errors) {
  const docs = (request.docIds || []).map((docId) => findDocument(example, docId)).filter(Boolean)
  const envelope = docContentEnvelopeForDocuments(docs)
  if (!envelope.fetchedDocIds.length) {
    errors.push('needDocs docIds must resolve to fetched document content')
    return []
  }

  for (const doc of Object.values(envelope.docContentById)) {
    if (!request.docIds.includes(doc.docId)) errors.push('docContentById docId must be included in needDocs.docIds')
    if (!['note', 'list'].includes(doc.docType)) errors.push('docContentById document docType must be note or list')
    if (doc.docType === 'list' && !Array.isArray(doc.docContent)) errors.push('list docContentById document docContent must be an array')
    if (doc.docType === 'list' && Array.isArray(doc.docContent)) {
      for (const item of doc.docContent) {
        if (!hasString(item.itemId)) errors.push('list docContentById items must include itemId')
        if (!hasString(item.itemContent)) errors.push('list docContentById items must include itemContent')
        if (typeof item.itemCompleted !== 'boolean') errors.push('list docContentById items must include itemCompleted boolean')
        if ('id' in item || 'content' in item || 'completed' in item) {
          errors.push('list docContentById items must use itemId/itemContent/itemCompleted, not id/content/completed')
        }
      }
    }
    if (doc.docType === 'note' && typeof doc.docContent !== 'string') errors.push('note docContentById document docContent must be a string')
  }

  return Object.values(envelope.docContentById)
}

function findToolItem(toolDoc, itemId) {
  if (!toolDoc || !Array.isArray(toolDoc.docContent)) return null
  return toolDoc.docContent.find((item) => item.itemId === itemId)
}

function validateModification(action, toolDocsById, errors) {
  const payload = action.actionPayload
  if (!payload?.docId) errors.push('modifyDoc.actionPayload.docId is required')
  const toolDoc = payload?.docId ? toolDocsById.get(payload.docId) : null
  if (payload?.docId && !toolDoc) errors.push('modifyDoc docId must have matching needDocs content')
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

  const docRequests = getExampleDocRequests(example)
  const seenDocIds = new Set()
  const toolDocsById = new Map()

  for (const request of docRequests) {
    validateDocRequest(example, request, errors, seenDocIds)
    const toolDocs = contentDocsForRequest(example, request, errors)
    for (const toolDoc of toolDocs) {
      if (toolDoc?.docId) toolDocsById.set(toolDoc.docId, toolDoc)
    }
  }

  for (const action of actions) {
    if (!action.actionType) errors.push('Action missing actionType')
    if (!action.actionPayload) errors.push(`Action ${action.actionType} missing actionPayload`)

    if (action.actionType === 'modifyDoc' && docRequests.length === 0) {
      errors.push('modifyDoc examples must include needDocs')
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
  const rest = { ...dataset }
  delete rest.promptTemplate
  return {
    ...rest,
    model: dataset.model || MODEL,
    examples: (dataset.examples || []).map(({ notes, toolOutput, toolCall, toolCalls, ...example }) => ({
      ...example,
      needDocs: example.needDocs ?? (() => {
        const legacy = Array.isArray(toolCalls) ? toolCalls.filter(Boolean) : (toolCall ? [toolCall] : [])
        const requests = legacy.map((call) => ({
          plan: call.plan || defaultNeedDocsPlan(example),
          docIds: Array.isArray(call.docIds) ? call.docIds : (call.docId ? [call.docId] : []),
        })).filter((request) => request.docIds.length)
        if (!requests.length) return null
        return requests.length === 1 ? requests[0] : requests
      })(),
    })),
  }
}
