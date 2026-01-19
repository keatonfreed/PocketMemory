import React, { useState } from 'react'
import DocumentFeed from '@/components/features/DocumentFeed'
import { Badge } from '@/components/ui/badge'
import useDocuments from '@/hooks/useDocuments'

export default function Browse() {
    const filterMap = { "All": "all", "Lists": "list", "Notes": "note" }
    const filters = ["All", "Lists", "Notes"]
    const [activeFilter, setActiveFilter] = useState("All")

    const userDocuments = useDocuments()

    const filteredDocuments = activeFilter === "All"
        ? userDocuments.getDocuments()
        : userDocuments.getDocuments().filter(d => d.docType === filterMap[activeFilter])

    return (
        <div className="min-h-dvh max-h-dvh flex flex-col pt-[max(48px,env(safe-area-inset-top))] px-4 pb-32">
            <h1 className="text-2xl font-bold mb-6 px-2 text-center">Documents</h1>

            <div className="flex gap-2 overflow-x-auto pb-4 px-2 no-scrollbar mb-4 justify-center min-h-max">
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
                <DocumentFeed documents={filteredDocuments} />
            </div>
        </div>
    )
}
