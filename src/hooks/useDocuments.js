import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid' // We need to mock uuid or install it. I'll use a simple random string for now to avoid dep if possible, but actually I installed no uuid lib. I'll use crypto.randomUUID

const useDocuments = create(
    persist(
        (set, get) => ({
            documents: [],

            createDocument: (document) => set((state) => ({
                documents: [{
                    docId: document.docId || crypto.randomUUID(),
                    isPinned: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    docMetadata: document.docMetadata || (document.docType === 'list' ? { listType: 'normal' } : {}),
                    ...document,
                    // Ensure list content is an array of objects
                    docContent: document.docType === 'list' && typeof document.docContent === 'string'
                        ? document.docContent.split('\n').filter(Boolean).map(c => ({
                            id: crypto.randomUUID(),
                            content: c,
                            completed: false,
                            quantity: ''
                        }))
                        : document.docContent
                }, ...state.documents]
            })),

            deleteDocument: (id) => set((state) => ({
                documents: state.documents.filter((d) => d.docId !== id)
            })),

            modifyDocument: (id, modifications) => set((state) => ({
                documents: state.documents.map((d) =>
                    d.docId === id ? { ...d, ...modifications, updatedAt: new Date().toISOString() } : d
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
                    (d.docContent || "").toLowerCase().includes(lowerQuery)
                );
            },
        }),
        {
            name: 'pocket-documents-db', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
        },
    ),
)

export default useDocuments
