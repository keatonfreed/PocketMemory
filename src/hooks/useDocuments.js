import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { newDocId, newItemId } from '@/lib/ids'

const STORE_VERSION = 2
const DOC_ID_RE = /^d[0-9a-z]{7}$/
const ITEM_ID_RE = /^i[0-9a-z]{7}$/

const makeUniqueId = (createId, usedIds) => {
    let id = createId()
    while (usedIds.has(id)) id = createId()
    usedIds.add(id)
    return id
}

export const normalizeListItem = (item, itemIdMap = new Map(), usedItemIds = new Set()) => {
    if (typeof item === 'string') {
        return {
            id: makeUniqueId(newItemId, usedItemIds),
            content: item,
            completed: false,
            quantity: '',
        }
    }

    const originalId = item?.id || item?.itemId || ''
    let id = originalId

    if (!ITEM_ID_RE.test(id) || usedItemIds.has(id)) {
        if (originalId && itemIdMap.has(originalId)) {
            id = itemIdMap.get(originalId)
        } else {
            id = makeUniqueId(newItemId, usedItemIds)
            if (originalId) itemIdMap.set(originalId, id)
        }
    } else {
        usedItemIds.add(id)
    }

    return {
        id,
        content: item?.content ?? item?.itemContent ?? '',
        completed: Boolean(item?.completed ?? item?.itemCompleted ?? false),
        quantity: item?.quantity || '',
    }
}

export const normalizeListContent = (content, itemIdMap = new Map(), usedItemIds = new Set()) => {
    if (typeof content === 'string') {
        return content
            .split('\n')
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => normalizeListItem(item, itemIdMap, usedItemIds))
    }

    if (Array.isArray(content)) return content.map(item => normalizeListItem(item, itemIdMap, usedItemIds))
    return []
}

const normalizeDocument = (document, docIdMap = new Map(), usedDocIds = new Set()) => {
    const originalDocId = document?.docId || ''
    let docId = originalDocId

    if (!DOC_ID_RE.test(docId) || usedDocIds.has(docId)) {
        if (originalDocId && docIdMap.has(originalDocId)) {
            docId = docIdMap.get(originalDocId)
        } else {
            docId = makeUniqueId(newDocId, usedDocIds)
            if (originalDocId) docIdMap.set(originalDocId, docId)
        }
    } else {
        usedDocIds.add(docId)
    }

    const itemIdMap = new Map()
    const usedItemIds = new Set()

    return {
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...document,
        docId,
        docMetadata: document.docMetadata || (document.docType === 'list' ? { listType: 'normal' } : {}),
        docContent: document.docType === 'list'
            ? normalizeListContent(document.docContent, itemIdMap, usedItemIds)
            : (document.docContent || ''),
    }
}

const migrateDocumentsState = (state) => {
    const docIdMap = new Map()
    const usedDocIds = new Set()

    return {
        ...state,
        documents: Array.isArray(state?.documents)
            ? state.documents.map(document => normalizeDocument(document, docIdMap, usedDocIds))
            : [],
    }
}

const applyAiModification = (document, modification) => {
    const modType = modification?.modType
    const payload = modification?.modPayload || {}

    if (!modType) return document

    if (modType === 'editNote') {
        if (document.docType !== 'note') return document
        return {
            ...document,
            docContent: payload.docContent ?? document.docContent ?? '',
        }
    }

    if (document.docType !== 'list') return document

    const currentItems = normalizeListContent(document.docContent)

    switch (modType) {
        case 'addListItem':
            return {
                ...document,
                docContent: [
                    ...currentItems,
                    normalizeListItem({
                        itemContent: payload.itemContent,
                        itemCompleted: payload.itemCompleted,
                    }),
                ],
            }

        case 'editListItem':
            return {
                ...document,
                docContent: currentItems.map(item =>
                    item.id === payload.itemId
                        ? {
                            ...item,
                            content: payload.itemContent ?? item.content,
                            completed: Boolean(payload.itemCompleted),
                        }
                        : item
                ),
            }

        case 'deleteListItem':
            return {
                ...document,
                docContent: currentItems.filter(item => item.id !== payload.itemId),
            }

        default:
            return document
    }
}

const applyAiMods = (document, mods = []) => {
    if (!Array.isArray(mods) || mods.length === 0) return document
    return mods.reduce(applyAiModification, document)
}

const useDocuments = create(
    persist(
        (set, get) => ({
            documents: [],

            createDoc: (document) => set((state) => ({
                documents: [normalizeDocument(document), ...state.documents]
            })),

            deleteDoc: (id) => set((state) => ({
                documents: state.documents.filter((d) => d.docId !== id)
            })),

            modifyDoc: (id, changes) => set((state) => ({
                documents: state.documents.map((d) =>
                    d.docId === id ? { ...d, ...changes, updatedAt: new Date().toISOString() } : d
                )
            })),

            applyAiMods: (id, mods) => set((state) => ({
                documents: state.documents.map((d) =>
                    d.docId === id
                        ? { ...applyAiMods(d, mods), updatedAt: new Date().toISOString() }
                        : d
                )
            })),

            togglePin: (id) => set((state) => ({
                documents: state.documents.map((d) =>
                    d.docId === id ? { ...d, isPinned: !d.isPinned, updatedAt: new Date().toISOString() } : d
                )
            })),

            renameDocument: (id, newTitle) => set((state) => ({
                documents: state.documents.map((d) =>
                    d.docId === id ? { ...d, docTitle: newTitle, updatedAt: new Date().toISOString() } : d
                )
            })),

            getDocuments: () => {
                const docs = get().documents;
                return [...docs].sort((a, b) => {
                    if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });
            },

            getDocument: (id) => get().documents.find((d) => d.docId === id),

            searchDocuments: (query) => {
                const lowerQuery = query.toLowerCase();
                const { documents } = get();
                if (!query) return documents;
                return documents.filter(d =>
                    (d.docTitle || "").toLowerCase().includes(lowerQuery) ||
                    (d.docSummary || "").toLowerCase().includes(lowerQuery) ||
                    (d.docTags || []).some(t => t.toLowerCase().includes(lowerQuery)) ||
                    JSON.stringify(d.docContent || "").toLowerCase().includes(lowerQuery)
                );
            },
        }),
        {
            name: 'pocket-documents-db', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
            version: STORE_VERSION,
            migrate: (persistedState) => migrateDocumentsState(persistedState),
        },
    ),
)

export default useDocuments
