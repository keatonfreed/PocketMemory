import React from 'react'
import useMemoryStore from '@/hooks/useMemoryStore'
import MemoryCard from './MemoryCard'
import { AnimatePresence } from 'framer-motion'

export default function MemoryFeed({ limit, memories: propMemories }) {
    const storeMemories = useMemoryStore(state => state.memories)
    // Use passed memories or fall back to store
    const sourceMemories = propMemories || storeMemories

    const displayMemories = limit ? sourceMemories.slice(0, limit) : sourceMemories

    if (sourceMemories.length === 0) {
        return (
            <div className="text-center py-12 opacity-30">
                <p className="text-sm">Your brain is empty.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2 pb-8">
            <AnimatePresence mode="popLayout">
                {displayMemories.map(memory => (
                    <MemoryCard key={memory.id} memory={memory} />
                ))}
            </AnimatePresence>

            {limit && sourceMemories.length > limit && (
                <div className="text-center pt-4">
                    <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        View all memories
                    </button>
                </div>
            )}
        </div>
    )
}
