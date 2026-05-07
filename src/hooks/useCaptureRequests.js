import { create } from 'zustand'
import { queryMemory } from '@/lib/ai'
import useDocuments from '@/hooks/useDocuments'
import { newDocId, newShortId } from '@/lib/ids'

const workingWords = ['Reading', 'Checking', 'Thinking']

const truncateText = (text, maxLength = 42) => {
    const compact = String(text || '').replace(/\s+/g, ' ').trim()
    return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact
}

const formatRequestMessage = (status, text) => {
    const compactStatus = String(status || 'Working').replace(/\s+/g, ' ').trim()
    const shortStatus = compactStatus.length > 22 ? `${compactStatus.slice(0, 19)}...` : compactStatus
    return `${shortStatus} "${truncateText(text)}"`
}

const formatTargetMessage = (status, target) => `${status} ${truncateText(target || 'memory', 46)}`

const formatBatchMessage = (status, targets) => {
    const uniqueTargets = [...new Set(targets.filter(Boolean))]
    const firstTarget = uniqueTargets[0] || 'memory'
    const extraCount = Math.max(0, uniqueTargets.length - 1)
    return `${status} ${truncateText(firstTarget, extraCount ? 34 : 46)}${extraCount ? ` +${extraCount} more` : ''}`
}

const statusForAction = (actionType) => {
    switch (actionType) {
        case 'createDoc': return 'Created'
        case 'modifyDoc': return 'Updated'
        case 'deleteDoc': return 'Deleted'
        case 'openDoc': return 'Opened'
        default: return 'Updated'
    }
}

const typeForAction = (actionType) => {
    switch (actionType) {
        case 'createDoc': return 'captured'
        case 'modifyDoc': return 'changed'
        case 'deleteDoc': return 'deleted'
        case 'openDoc': return 'opened'
        default: return 'captured'
    }
}

const getDocumentTitle = (docId) => {
    if (!docId) return ''
    return useDocuments.getState().getDocument(docId)?.docTitle || ''
}

const getContext = () => useDocuments.getState().getDocuments().map(m => ({
    docId: m.docId,
    docTitle: m.docTitle,
    docSummary: m.docSummary,
    docTags: m.docTags,
    docType: m.docType,
    docMetadata: m.docMetadata,
    docContent: m.docContent,
}))

const logCaptureAI = (requestId, step, details = {}) => {
    const shortId = requestId?.slice?.(0, 8) || 'unknown'
    console.log(`[capture-ai:${shortId}] ${step}`, details)
}

const useCaptureRequests = create((set, get) => ({
    activeRequestCount: 0,
    requests: [],
    debugRuns: [],

    addDebugEvent: (requestId, step, details = {}) => set(state => {
        const existingIndex = state.debugRuns.findIndex(run => run.requestId === requestId)
        const event = {
            id: newShortId(),
            step,
            details,
            at: new Date().toISOString(),
        }

        if (existingIndex === -1) {
            return {
                debugRuns: [{
                    requestId,
                    shortId: requestId.slice(0, 8),
                    text: details.text || '',
                    startedAt: event.at,
                    status: step === 'failed' ? 'failed' : 'running',
                    events: [event],
                }, ...state.debugRuns].slice(0, 12)
            }
        }

        const debugRuns = [...state.debugRuns]
        const existing = debugRuns[existingIndex]
        const nextStatus = step === 'failed'
            ? 'failed'
            : (step === 'final.output' && existing.status !== 'failed' ? 'finished' : existing.status)
        debugRuns[existingIndex] = {
            ...existing,
            text: existing.text || details.text || '',
            status: nextStatus,
            events: [...existing.events, event].slice(-40),
        }
        return { debugRuns }
    }),

    clearDebugRuns: () => set({ debugRuns: [] }),

    upsertRequest: (requestId, patch) => set(state => {
        const existingIndex = state.requests.findIndex(request => request.requestId === requestId)
        const nextRequest = {
            id: requestId,
            requestId,
            ...patch,
        }

        if (existingIndex === -1) {
            return { requests: [...state.requests, nextRequest] }
        }

        const requests = [...state.requests]
        requests[existingIndex] = {
            ...requests[existingIndex],
            ...nextRequest,
            id: requests[existingIndex].id,
        }
        return { requests }
    }),

    removeRequest: (requestId) => set(state => ({
        requests: state.requests.filter(request => request.requestId !== requestId)
    })),

    finishRequest: (requestId, patch, delay = 2400) => {
        get().upsertRequest(requestId, { ...patch, status: patch.status || 'done' })
        window.setTimeout(() => {
            get().removeRequest(requestId)
        }, delay)
    },

    addProgressTarget: (requestId, target) => {
        const cleanTarget = String(target || '').trim()
        if (!cleanTarget) return []

        let nextTargets = []
        set(state => ({
            requests: state.requests.map(request => {
                if (request.requestId !== requestId) return request
                nextTargets = [...new Set([...(request.progressTargets || []), cleanTarget])]
                return { ...request, progressTargets: nextTargets }
            })
        }))
        return nextTargets
    },

    startRequest: async (text, { navigate } = {}) => {
        const inputContent = String(text || '').trim()
        if (!inputContent) return null

        const requestId = newShortId()
        const startingWord = workingWords[Math.floor(Math.random() * workingWords.length)]
        const context = getContext()
        const debugLog = (step, details = {}) => {
            logCaptureAI(requestId, step, details)
            get().addDebugEvent(requestId, step, details)
        }

        set(state => ({ activeRequestCount: state.activeRequestCount + 1 }))
        get().upsertRequest(requestId, {
            message: formatRequestMessage(startingWord, inputContent),
            type: 'progress',
            status: 'running',
            requestText: inputContent,
        })

        debugLog('queued', {
            text: inputContent,
            contextCount: context.length,
            context: context.map(doc => ({
                docId: doc.docId,
                docTitle: doc.docTitle,
                docSummary: doc.docSummary,
                docType: doc.docType,
                docTags: doc.docTags,
                docMetadata: doc.docMetadata,
                contentType: Array.isArray(doc.docContent) ? 'list' : typeof doc.docContent,
                contentLength: Array.isArray(doc.docContent) ? doc.docContent.length : String(doc.docContent || '').length,
            })),
        })

        let sawFinal = false

        try {
            const stream = queryMemory(inputContent, context, { requestId })

            for await (const event of stream) {
                if (event.type === 'error') {
                    throw new Error(event.message || 'AI request failed')
                }

                if (event.type === 'debug') {
                    debugLog(event.step || 'debug', event.details || {})
                } else if (event.type === 'progress') {
                    const progressTarget = event.docTitle || getDocumentTitle(event.docId)
                    const progressTargets = get().addProgressTarget(requestId, progressTarget)
                    const progressMessage = progressTarget
                        ? formatBatchMessage('Reading', progressTargets)
                        : formatRequestMessage(event.message || 'Working', inputContent)

                    get().upsertRequest(requestId, {
                        message: progressMessage,
                        type: 'progress',
                        status: 'running',
                        docId: event.docId,
                        requestText: inputContent,
                    })
                } else if (event.type === 'final') {
                    sawFinal = true
                    const data = event.data
                    debugLog('final.output', {
                        meta: event.meta,
                        output: data || {},
                    })

                    if (data?.actions?.length) {
                        const appliedActions = []

                        data.actions.forEach(action => {
                            switch (action.actionType) {
                                case 'createDoc': {
                                    const docId = newDocId()
                                    const title = action.actionPayload.docTitle
                                    useDocuments.getState().createDoc({
                                        docId,
                                        docTitle: title,
                                        docContent: action.actionPayload.docContent,
                                        docSummary: action.actionPayload.docSummary,
                                        docTags: action.actionPayload.docTags,
                                        docType: action.actionPayload.docType,
                                        docMetadata: action.actionPayload.docMetadata,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    })
                                    appliedActions.push({ actionType: action.actionType, docId, title })
                                    break
                                }
                                case 'modifyDoc': {
                                    const title = action.actionPayload.docTitle || getDocumentTitle(action.actionPayload.docId)
                                    useDocuments.getState().applyAiMods(
                                        action.actionPayload.docId,
                                        action.actionPayload.mods
                                    )
                                    appliedActions.push({ actionType: action.actionType, docId: action.actionPayload.docId, title })
                                    break
                                }
                                case 'deleteDoc': {
                                    const title = action.actionPayload.docTitle || getDocumentTitle(action.actionPayload.docId)
                                    useDocuments.getState().deleteDoc(action.actionPayload.docId)
                                    appliedActions.push({ actionType: action.actionType, docId: action.actionPayload.docId, title })
                                    break
                                }
                                case 'openDoc': {
                                    const title = action.actionPayload.docTitle || getDocumentTitle(action.actionPayload.docId)
                                    appliedActions.push({ actionType: action.actionType, docId: action.actionPayload.docId, title })
                                    navigate?.(`/app/document/${action.actionPayload.docId}`)
                                    break
                                }
                                default:
                                    throw new Error(`Unknown action: ${action.actionType}`)
                            }
                        })

                        const firstAction = appliedActions[0]
                        get().finishRequest(requestId, {
                            message: formatBatchMessage(statusForAction(firstAction.actionType), appliedActions.map(action => action.title)),
                            type: typeForAction(firstAction.actionType),
                            docId: firstAction.docId,
                            requestText: inputContent,
                        })
                    } else {
                        get().finishRequest(requestId, {
                            message: formatRequestMessage('No change', inputContent),
                            type: 'captured',
                            requestText: inputContent,
                        })
                        debugLog('final.no_actions', {
                            text: inputContent,
                        })
                    }
                }
            }

            if (!sawFinal) {
                throw new Error('AI request ended before returning a result')
            }
        } catch (err) {
            console.error(`[capture-ai:${requestId.slice(0, 8)}] failed`, err)
            get().addDebugEvent(requestId, 'failed', {
                message: err?.message || 'AI request failed',
            })
            get().finishRequest(requestId, {
                message: formatRequestMessage('Failed', inputContent),
                type: 'failed',
                status: 'failed',
                requestText: inputContent,
            }, 3600)
        } finally {
            set(state => ({ activeRequestCount: Math.max(0, state.activeRequestCount - 1) }))
        }

        return requestId
    },
}))

export default useCaptureRequests
