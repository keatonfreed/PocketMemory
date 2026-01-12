import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid' // We need to mock uuid or install it. I'll use a simple random string for now to avoid dep if possible, but actually I installed no uuid lib. I'll use crypto.randomUUID

const useMemoryStore = create(
    persist(
        (set, get) => ({
            memories: [],

            addMemory: (memory) => set((state) => ({
                memories: [{
                    id: memory.id || crypto.randomUUID(),
                    ...memory
                }, ...state.memories]
            })),

            deleteMemory: (id) => set((state) => ({
                memories: state.memories.filter((m) => m.id !== id)
            })),

            updateMemory: (id, updates) => set((state) => ({
                memories: state.memories.map((m) =>
                    m.id === id ? { ...m, ...updates } : m
                )
            })),

            searchMemories: (query) => {
                const lowerQuery = query.toLowerCase();
                const { memories } = get();
                if (!query) return memories;
                return memories.filter(m =>
                    m.title.toLowerCase().includes(lowerQuery) ||
                    m.summary.toLowerCase().includes(lowerQuery) ||
                    m.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
                    m.content?.toLowerCase().includes(lowerQuery)
                );
            },

            getMemory: (id) => get().memories.find((m) => m.id === id),
        }),
        {
            name: 'pocket-memory-db', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
        },
    ),
)

export default useMemoryStore
