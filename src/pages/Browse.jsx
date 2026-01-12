import React, { useState } from 'react'
import MemoryFeed from '@/components/features/MemoryFeed'
import StickyNav from '@/components/layout/StickyNav'
import { Badge } from '@/components/ui/badge'
import useMemoryStore from '@/hooks/useMemoryStore'

export default function Browse() {
    const filters = ["All", "Links", "Notes", "Tasks", "Ideas"]
    const [activeFilter, setActiveFilter] = useState("All")

    // We need to pass the filter to MemoryFeed or filter here. 
    // Let's filter here for simplicity as MemoryFeed accepts a 'memories' prop override? 
    // No, MemoryFeed pulls from store. Let's make MemoryFeed accept a `filter` function or prop.
    // actually MemoryFeed pulls all.
    // Let's query the specific items here.
    const allMemories = useMemoryStore(state => state.memories)

    const filteredMemories = activeFilter === "All"
        ? allMemories
        : allMemories.filter(m => m.type === activeFilter.slice(0, -1).toLowerCase()) // "Links" -> "link"

    return (
        <div className="min-h-screen flex flex-col pt-12 px-4 pb-32">
            <h1 className="text-2xl font-bold mb-6 px-2 text-center glow-text">Timeline</h1>

            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-4 px-2 no-scrollbar mb-4 justify-center">
                {filters.map(f => (
                    <Badge
                        key={f}
                        variant={activeFilter === f ? "default" : "secondary"}
                        className={activeFilter === f ? "hover:bg-primary" : "hover:bg-secondary/80"}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setActiveFilter(f)}
                    >
                        {f}
                    </Badge>
                ))}
            </div>

            <div className="flex-1">
                <MemoryFeed memories={filteredMemories} />
            </div>
        </div>
    )
}
