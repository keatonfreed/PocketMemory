import React, { forwardRef, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Sparkles, Clock, MoreHorizontal, FileText, CheckSquare, Pin, Trash2, Edit2, X, Apple } from 'lucide-react'
import { cn } from '@/lib/utils'
import useDocuments from '@/hooks/useDocuments'
import { useNavigate } from 'react-router-dom'

const TypeIcon = ({ type, metadata }) => {
    if (type === 'list' && metadata?.listType === 'grocery') {
        return <Apple size={14} className="text-emerald-400" />
    }
    switch (type) {
        case 'link': return <ExternalLink size={14} className="text-blue-400" />
        case 'list': return <CheckSquare size={14} className="text-green-400" />
        case 'note': return <FileText size={14} className="text-yellow-400" />
        case 'loading': return <Sparkles size={14} className="text-primary animate-spin" />
        default: return <FileText size={14} className="text-muted-foreground" />
    }
}

const DocumentCard = forwardRef(({ document, isSummary, className }, ref) => {
    const { docId, docTitle, docSummary, docTags, docType, isPinned, docMetadata } = document
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef(null)
    const navigate = useNavigate()
    const { deleteDocument, togglePin } = useDocuments()

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false)
            }
        }
        if (showMenu) {
            window.document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            window.document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    const handleAction = (e, action) => {
        e.stopPropagation()
        switch (action) {
            case 'pin':
                togglePin(docId)
                setShowMenu(false)
                break
            case 'delete':
                if (window.confirm('Delete this document?')) {
                    deleteDocument(docId)
                }
                setShowMenu(false)
                break
            case 'rename':
                setIsRenaming(true)
                setShowMenu(false)
                break
            default:
                break
        }
    }

    const handleRenameSubmit = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (newTitle.trim()) {
            renameDocument(docId, newTitle.trim())
            setIsRenaming(false)
        }
    }

    return (
        <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, zIndex: showMenu ? 50 : 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01, zIndex: showMenu ? 50 : 40 }}
            className="relative"
        >
            <Card
                as="div"
                onClick={() => navigate(`/document/${docId}`)}
                className={cn(
                    "relative border-1 bg-card/90 hover:bg-card/100 transition-colors cursor-pointer overflow-hidden backdrop-blur-md",
                    isPinned ? "border-primary/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "border-secondary/70",
                    className
                )}
            >
                <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-2 items-center flex-1 min-w-0">
                            <div className="p-1.5 rounded-md bg-secondary/50 shrink-0 flex items-center gap-1.5">
                                <TypeIcon type={docType} metadata={docMetadata} />
                                {isPinned && <Pin size={10} className="text-primary fill-primary" />}
                            </div>
                            <CardTitle className="text-base font-medium truncate leading-tight text-foreground/90">
                                {docTitle}
                            </CardTitle>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowMenu(!showMenu)
                            }}
                            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                        >
                            <MoreHorizontal size={18} />
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="p-4 pt-1">
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {docSummary}
                    </p>

                    {(!isSummary && (docTags?.length > 0)) && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {docTags.map(tag => (
                                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px] uppercase tracking-wider opacity-70 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                                    #{tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-4 top-12 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1 min-w-[140px] overflow-hidden"
                    >
                        <button
                            onClick={(e) => handleAction(e, 'pin')}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-white/5 transition-colors rounded-lg text-left"
                        >
                            <Pin size={14} className={cn(isPinned && "fill-primary text-primary")} />
                            {isPinned ? 'Unpin' : 'Pin to Top'}
                        </button>
                        <div className="h-px bg-white/5 my-1" />
                        <button
                            onClick={(e) => handleAction(e, 'delete')}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors rounded-lg text-left"
                        >
                            <Trash2 size={14} />
                            Delete
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
})

DocumentCard.displayName = "DocumentCard"

export default DocumentCard
