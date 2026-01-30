import React from 'react'
import useDocuments from '@/hooks/useDocuments'
import DocumentCard from './DocumentCard'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function DocumentFeed({ limit, documents: propDocuments, isSummary = false }) {
    const userDocuments = useDocuments()
    // Use passed memories or fa3ll back to store
    const sourceDocuments = propDocuments || userDocuments.getDocuments()

    const displayDocuments = limit ? sourceDocuments.slice(0, limit) : sourceDocuments

    if (sourceDocuments.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.3, y: 0 }}
                className="text-center py-12">
                <p className="text-sm ">{isSummary ? "You have no documents yet." : "Your brain vault is empty."}</p>
            </motion.div>
        )
    }




    return (


        <div className={cn("gap-2 pb-8 px-4", isSummary ? "grid grid-cols-2" : "flex flex-col")}>
            <AnimatePresence mode="popLayout">
                {displayDocuments.map(document => (
                    <DocumentCard key={document.docId} document={document} isSummary={isSummary} className="h-full" />
                ))}
            </AnimatePresence>

            {limit && sourceDocuments.length > limit && (
                <div className="text-center pt-4 col-span-2">
                    <Link to="/browse" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        View all documents
                    </Link>
                </div>
            )}
        </div>

    )
}
