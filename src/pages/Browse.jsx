import React, { useState, useEffect, useMemo, useRef } from 'react'
import DocumentFeed from '@/components/features/DocumentFeed'
import { Badge } from '@/components/ui/badge'
import useDocuments from '@/hooks/useDocuments'
import { Search, X, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function Browse() {
    const filterMap = { "All": "all", "Lists": "list", "Notes": "note" }
    const filters = ["All", "Lists", "Notes"]
    const [activeFilter, setActiveFilter] = useState("All")
    const [searchQuery, setSearchQuery] = useState("")
    const [showSearch, setShowSearch] = useState(false)
    const searchInputRef = useRef(null)

    const userDocuments = useDocuments()
    const allDocs = userDocuments.getDocuments()



    // Extract unique tags from all documents
    const allTags = useMemo(() => {
        const tags = new Set()
        allDocs.forEach(d => {
            if (d.docTags) d.docTags.forEach(t => tags.add(t))
        })
        return Array.from(tags).sort()
    }, [allDocs])

    useEffect(() => {
        if (showSearch) {
            setActiveFilter('All')

            // Only auto-focus on non-mobile devices to avoid keyboard popups on iPhone
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            if (!isMobile) {
                setTimeout(() => {
                    searchInputRef.current?.focus()
                }, 100) // Small delay to allow animation to start/input to become interactive
            }
        }
    }, [showSearch])

    const filteredDocuments = useMemo(() => {
        let docs = allDocs

        // Filter by type
        if (activeFilter !== "All") {
            docs = docs.filter(d => d.docType === filterMap[activeFilter])
        }

        // Filter by search query (hashtags or title)
        if (searchQuery) {
            const query = searchQuery.toLowerCase().replace('#', '')
            docs = docs.filter(d =>
                (d.docTitle || "").toLowerCase().includes(query) ||
                (d.docTags || []).some(t => t.toLowerCase().includes(query))
            )
        }

        return docs
    }, [allDocs, activeFilter, searchQuery])



    return (
        <div className="min-h-dvh max-h-dvh flex flex-col pt-[max(48px,env(safe-area-inset-top))] pb-32 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-6 px-6 text-center text-foreground/90">Documents</h1>

            <motion.div layout className="flex flex-col gap-2 mb-6 px-4 ">
                <motion.div layout className="flex items-center gap-2 overflow-hidden py-1 w-full justify-center">
                    <motion.button
                        layout
                        onClick={() => {
                            setShowSearch(!showSearch)
                            if (showSearch) setSearchQuery('')
                        }}
                        className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-full border transition-colors duration-300 shrink-0 aspect-square z-20",
                            showSearch ? "bg-primary border-primary text-white" : "bg-secondary/50 border-secondary/70 text-muted-foreground"
                        )}
                    >
                        <motion.div
                            key={showSearch ? "close" : "search"}
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {showSearch ? <X size={16} /> : <Search size={16} />}
                        </motion.div>
                    </motion.button>

                    <motion.div layout className="h-4 w-px bg-white/10 mx-1 shrink-0" />

                    <motion.div className={cn("overflow-hidden flex justify-center min-w-1/2 transition-all duration-300 ease-in-out", showSearch ? "flex-1" : "")}>
                        <AnimatePresence mode="popLayout">
                            {!showSearch ? (
                                <motion.div
                                    key="filters"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -35 }}
                                    transition={{ duration: 0.25 }}
                                    className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full justify-center"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {filters.map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setActiveFilter(f)}
                                            className={cn(
                                                "px-4 h-9 rounded-full text-sm font-semibold whitespace-nowrap border transition-all duration-300",
                                                activeFilter === f
                                                    ? "bg-primary border-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                                                    : "bg-secondary/50 border-secondary/70 text-muted-foreground hover:bg-secondary/80"
                                            )}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="tags"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {allTags.slice(0, 10).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSearchQuery(prev => prev.includes('#' + tag) ? '' : '#' + tag)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                                                searchQuery.includes('#' + tag)
                                                    ? "bg-primary/20 border-primary/40 text-primary"
                                                    : "bg-secondary/50 border-secondary/70 text-muted-foreground hover:bg-secondary/80"
                                            )}
                                        >
                                            <Hash size={12} />
                                            {tag}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>

                <AnimatePresence>
                    <motion.div
                        initial={false}
                        animate={
                            showSearch
                                ? { maxHeight: 48, opacity: 1, marginTop: 8 }
                                : { maxHeight: 0, opacity: 0, marginTop: 0 }
                        }
                        transition={{ duration: 0.3 }}
                        className="relative px-2 overflow-hidden"
                        style={{ pointerEvents: showSearch ? "auto" : "none" }}
                    >
                        <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            ref={searchInputRef}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search titles or #hashtags..."
                            className="w-full bg-secondary/30 border border-secondary/50 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-colors"
                        />
                    </motion.div>
                </AnimatePresence>
            </motion.div>

            <div className="flex-1">
                <DocumentFeed documents={filteredDocuments} />

            </div>
        </div>
    )
}
