import React, { useEffect, useMemo, useState } from 'react'
import { Bug, ChevronRight, Database, ListTree, X } from 'lucide-react'
import useCaptureRequests from '@/hooks/useCaptureRequests'
import useDocuments from '@/hooks/useDocuments'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'pocket-dev-ai-panel'
const VERCEL_ENV = typeof __VERCEL_ENV__ === 'string' ? __VERCEL_ENV__ : ''
const ENV_ENABLED = import.meta.env.DEV || VERCEL_ENV === 'preview' || VERCEL_ENV === 'development'

const getStoredEnabled = () => ENV_ENABLED && window.localStorage.getItem(STORAGE_KEY) === '1'

const formatTime = (value) => {
    if (!value) return ''
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const JsonBlock = ({ value }) => (
    <pre className="mt-1 max-h-80 select-text overflow-auto rounded-md bg-black/35 p-2 text-[10px] leading-relaxed text-zinc-300">
        {JSON.stringify(value, null, 2)}
    </pre>
)

const summarizeEvent = (event) => {
    const details = event.details || {}
    if (event.step === 'queued') return `${details.contextCount || 0} docs`
    if (event.step === 'tool.get_docs') {
        const title = details.docTitles?.join(', ') || details.docTitle || details.docId || 'document'
        const time = details.modelMs ? ` · ${Math.round(details.modelMs)}ms` : ''
        return `${title} · ${details.contentType || 'content'} ${details.contentLength ?? ''}${time}`
    }
    if (event.step === 'need_docs') {
        const title = details.docTitles?.join(', ') || details.docIds?.join(', ') || 'documents'
        const time = details.modelMs ? ` · ${Math.round(details.modelMs)}ms` : ''
        return `${title} · ${details.contentType || 'content'} ${details.contentLength ?? ''}${time}`
    }
    if (event.step === 'need_docs.denied') {
        const ids = details.requestedDocIds?.join(', ') || 'no ids'
        return `${details.reason || 'denied'} · ${ids}`
    }
    if (event.step === 'tool.get_docs.denied') {
        const ids = details.docIds?.join(', ') || details.requestedDocIds?.join(', ') || 'no ids'
        return `${details.reason || 'denied'} · ${ids}`
    }
    if (event.step === 'tool.denied') {
        return `${details.reason || 'denied'} · ${details.name || 'tool'}`
    }
    if (event.step === 'final.output') {
        const actionCount = details.output?.actions?.length || details.actions?.length || 0
        const time = details.meta?.modelMs ? ` · ${Math.round(details.meta.modelMs)}ms` : ''
        return `${actionCount} actions${time}`
    }
    if (event.step === 'failed') return details.message || 'failed'
    return ''
}

export default function DevAiDebugPanel() {
    const [enabled, setEnabled] = useState(false)
    const [expandedEvents, setExpandedEvents] = useState(() => new Set())
    const documents = useDocuments(state => state.documents)
    const debugRuns = useCaptureRequests(state => state.debugRuns)
    const clearDebugRuns = useCaptureRequests(state => state.clearDebugRuns)

    useEffect(() => {
        if (!ENV_ENABLED || typeof window === 'undefined') return

        window.PocketMemoryDebug = {
            enableAiPanel: () => {
                if (!ENV_ENABLED) {
                    console.warn('AI debug panel is disabled outside local dev or Vercel preview/development.')
                    return false
                }

                window.localStorage.setItem(STORAGE_KEY, '1')
                setEnabled(true)
                return true
            },
            disableAiPanel: () => {
                window.localStorage.removeItem(STORAGE_KEY)
                setEnabled(false)
                return true
            },
        }

        setEnabled(getStoredEnabled())

        return () => {
            delete window.PocketMemoryDebug
        }
    }, [])

    const sortedDocuments = useMemo(() => {
        return [...documents].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    }, [documents])

    if (!ENV_ENABLED || !enabled) return null

    const disable = () => {
        window.localStorage.removeItem(STORAGE_KEY)
        setEnabled(false)
    }

    const downloadLatest = () => {
        const latest = debugRuns[0]
        if (!latest) return
        const blob = new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `pocket-memory-ai-debug-${latest.shortId || 'latest'}.json`
        link.click()
        URL.revokeObjectURL(url)
    }

    const toggleEvent = (eventId) => {
        setExpandedEvents(prev => {
            const next = new Set(prev)
            if (next.has(eventId)) next.delete(eventId)
            else next.add(eventId)
            return next
        })
    }

    return (
        <>
            <aside className="ai-debug-panel fixed left-3 top-3 bottom-3 z-[100] hidden w-[min(250px,calc(50vw-280px))] min-w-[190px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/92 text-zinc-100 shadow-2xl backdrop-blur-xl lg:block">
                <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-zinc-300">
                    <Database size={13} />
                    Documents
                    <span className="ml-auto text-zinc-500">{sortedDocuments.length}</span>
                </div>

                <div className="h-[calc(100%-34px)] overflow-auto p-2">
                    {sortedDocuments.length === 0 ? (
                        <div className="px-2 py-8 text-center text-[11px] text-zinc-500">No documents yet.</div>
                    ) : sortedDocuments.map(doc => (
                        <div key={doc.docId} className="mb-1 rounded-lg border border-white/5 bg-white/[0.025] p-2">
                            <div className="truncate text-[11px] font-medium text-zinc-100">{doc.docTitle || 'Untitled'}</div>
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                                <span className="rounded bg-white/5 px-1.5 py-0.5">{doc.docType || 'doc'}</span>
                                {doc.docMetadata?.listType && <span className="rounded bg-white/5 px-1.5 py-0.5">{doc.docMetadata.listType}</span>}
                            </div>
                            <div className="mt-1 break-all font-mono text-[10px] leading-snug text-zinc-500">{doc.docId}</div>
                        </div>
                    ))}
                </div>
            </aside>

            <aside className="ai-debug-panel fixed right-3 top-3 bottom-3 z-[100] w-[min(330px,calc(50vw-280px))] min-w-[230px] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/92 text-zinc-100 shadow-2xl backdrop-blur-xl max-lg:hidden 2xl:w-[min(390px,calc(50vw-300px))]">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                        <Bug size={14} className="text-primary" />
                        <div>
                            <div className="text-xs font-semibold">AI Debug</div>
                            <div className="text-[10px] text-zinc-500">dev/preview only, console enabled</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={clearDebugRuns}
                            className="rounded-md px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                        >
                            Clear
                        </button>
                        <button
                            onClick={downloadLatest}
                            disabled={!debugRuns.length}
                            className="rounded-md px-2 py-1 text-[10px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            JSON
                        </button>
                        <button
                            onClick={disable}
                            className="rounded-md p-1 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
                            title="Disable AI debug panel"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="h-[calc(100%-45px)] overflow-auto p-2">
                    <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-zinc-300">
                        <ListTree size={13} />
                        Request Trace
                        <span className="ml-auto text-zinc-500">{debugRuns.length}</span>
                    </div>

                    <div className="pt-2">
                        {debugRuns.length === 0 ? (
                            <div className="px-2 py-8 text-center text-[11px] text-zinc-500">Send a capture to see AI steps.</div>
                        ) : debugRuns.map(run => (
                            <article key={run.requestId} className="mb-2 rounded-lg border border-white/8 bg-white/[0.025]">
                                <header className="border-b border-white/5 px-2.5 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "h-2 w-2 rounded-full",
                                            run.status === 'failed' ? "bg-red-400" : run.status === 'finished' ? "bg-emerald-400" : "bg-primary"
                                        )} />
                                        <span className="font-mono text-[10px] text-zinc-400">{run.shortId}</span>
                                        <span className="ml-auto text-[10px] text-zinc-500">{formatTime(run.startedAt)}</span>
                                    </div>
                                    {run.text && <div className="mt-1 line-clamp-2 text-[11px] text-zinc-200">{run.text}</div>}
                                </header>

                                <div className="p-2">
                                    {run.events.map(event => {
                                        const isExpanded = expandedEvents.has(event.id)
                                        const hasDetails = Object.keys(event.details || {}).length > 0
                                        return (
                                        <div key={event.id} className="mb-1 last:mb-0">
                                            <button
                                                type="button"
                                                onClick={() => hasDetails && toggleEvent(event.id)}
                                                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-white/5"
                                            >
                                                <ChevronRight size={12} className={cn("shrink-0 text-zinc-500 transition", isExpanded && "rotate-90 text-zinc-300", !hasDetails && "opacity-25")} />
                                                <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-primary">{event.step}</span>
                                                <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-400">{summarizeEvent(event)}</span>
                                                <span className="text-[10px] text-zinc-500">{formatTime(event.at)}</span>
                                            </button>
                                            {hasDetails && isExpanded && <JsonBlock value={event.details} />}
                                        </div>
                                        )
                                    })}
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </aside>
        </>
    )
}
