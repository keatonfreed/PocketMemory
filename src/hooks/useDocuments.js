import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid' // We need to mock uuid or install it. I'll use a simple random string for now to avoid dep if possible, but actually I installed no uuid lib. I'll use crypto.randomUUID

const useDocuments = create(
    persist(
        (set, get) => ({
            documents: [],

            createDocument: (document) => set((state) => ({
                documents: [{
                    id: document.docId || crypto.randomUUID(),
                    ...document
                }, ...state.documents]
            })),

            deleteDocument: (id) => set((state) => ({
                documents: state.documents.filter((d) => d.docId !== id)
            })),

            modifyDocument: (id, modifications) => set((state) => ({
                documents: state.documents.map((d) =>
                    d.docId === id ? { ...d, ...modifications } : d
                )
            })),

            getDocuments: () => get().documents,
            getDocument: (id) => get().documents.find((d) => d.docId === id),

            searchDocuments: (query) => {
                const lowerQuery = query.toLowerCase();
                const { documents } = get();
                if (!query) return documents;
                return documents.filter(d =>
                    d.title.toLowerCase().includes(lowerQuery) ||
                    d.summary.toLowerCase().includes(lowerQuery) ||
                    d.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
                    d.content?.toLowerCase().includes(lowerQuery)
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
