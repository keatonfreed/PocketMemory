import React, { useState, useEffect } from 'react'
import StickyNav from '@/components/layout/StickyNav'
import MemoryCard from '@/components/features/MemoryCard'
import useMemoryStore from '@/hooks/useMemoryStore'
import { Search as SearchIcon, X } from 'lucide-react'

export default function Search() {
    const [query, setQuery] = useState('')
    const searchMemories = useMemoryStore(state => state.searchMemories)
    const [results, setResults] = useState([])

    useEffect(() => {
        setResults(searchMemories(query))
    }, [query, searchMemories])

    return (
        <div className="min-h-screen flex flex-col pt-8 px-4 pb-32">
            <h1 className="text-2xl font-bold mb-6 px-2 text-center text-primary/80">Neural Search</h1>

            <div className="relative mb-6 max-w-md mx-auto w-full">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search your brain..."
                    className="w-full bg-secondary/30 border border-secondary rounded-xl py-3 pl-10 pr-10 outline-none focus:border-primary/50 transition-colors"
                />
                {query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X size={16} />
                    </button>
                )}
            </div>

            <div className="flex-1 pb-24">
                {results.length === 0 && query ? (
                    <div className="text-center text-muted-foreground mt-12">
                        No memories found for "{query}"
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {results.map(m => <MemoryCard key={m.id} memory={m} />)}
                    </div>
                )}
            </div>
        </div>
    )
}
