import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Sparkles, Hash, Clock, MoreHorizontal, FileText, CheckSquare, Lightbulb } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const TypeIcon = ({ type }) => {
    switch (type) {
        case 'link': return <ExternalLink size={14} className="text-blue-400" />
        case 'list': return <CheckSquare size={14} className="text-green-400" />
        // case 'note': return <Lightbulb size={14} className="text-yellow-400" />
        case 'note': return <FileText size={14} className="text-yellow-400" />
        case 'loading': return <Sparkles size={14} className="text-primary animate-spin" />
        default: return <FileText size={14} className="text-muted-foreground" />
    }
}

const DocumentCard = forwardRef(({ document, isSummary, className }, ref) => {
    const { docId, docTitle, docSummary, docTags, docType, createdAt } = document

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
        >
            <Card to={`/document/${docId}`} className={cn("border-1 border-secondary/70 bg-card/90 hover:bg-card/100 transition-colors cursor-pointer overflow-hidden backdrop-blur-md", className)}>
                <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-2 items-center flex-1 min-w-0">
                            <div className="p-1.5 rounded-md bg-secondary/50 shrink-0">
                                <TypeIcon type={docType} />
                            </div>
                            <CardTitle className="text-base font-medium truncate leading-tight text-foreground/90">
                                {docTitle}
                            </CardTitle>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground">
                            <MoreHorizontal size={16} />
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="p-4 pt-1">
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {docSummary}
                    </p>

                    {(!isSummary && (docTags.length > 0)) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {docTags.map(tag => (
                                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px] uppercase tracking-wider opacity-70 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                                    #{tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>

                {/* <CardFooter className="p-4 pt-0 text-[10px] text-muted-foreground flex justify-between">
           <span className="flex items-center gap-1">
             <Clock size={10} /> {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
           </span>
        </CardFooter> */}
            </Card>
        </motion.div>
    )
})

DocumentCard.displayName = "DocumentCard"

export default DocumentCard
