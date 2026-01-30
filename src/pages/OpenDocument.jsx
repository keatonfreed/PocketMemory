import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import useDocuments from '@/hooks/useDocuments'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, ChevronLeft, Check, RotateCcw, Settings, Apple, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'

const ListItem = ({ item, index, onUpdate, onRemove, onToggleComplete, isNew }) => {
    const x = useMotionValue(0)
    const inputRef = useRef(null)
    const containerRef = useRef(null)
    const [isOpen, setIsOpen] = useState(false)

    // Swipe Constants
    const ACTION_WIDTH = 80
    const FULL_SWIPE_THRESHOLD = 150

    useEffect(() => {
        if (isNew && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isNew])

    // Reset position if item changes (e.g. restoration)
    useEffect(() => {
        animate(x, 0)
        setIsOpen(false)
    }, [item.completed])

    const handleDragEnd = async (e, { offset, velocity }) => {
        const currentX = x.get()
        let targetX = 0

        // Determine target based on drag distance and velocity
        if (currentX > FULL_SWIPE_THRESHOLD) {
            // Full Right Swipe -> Restore/Complete
            targetX = 1000 // Swipe fully off screen
            await animate(x, targetX, { type: "spring", stiffness: 300, damping: 30 }).finished
            if (item.completed) onToggleComplete(index)
            else onToggleComplete(index)
            return
        } else if (currentX < -FULL_SWIPE_THRESHOLD) {
            // Full Left Swipe -> Delete/Complete
            targetX = -1000 // Swipe fully off screen
            await animate(x, targetX, { type: "spring", stiffness: 300, damping: 30 }).finished
            if (item.completed) onRemove(index)
            else onToggleComplete(index)
            return
        } else if (currentX > ACTION_WIDTH / 2) {
            // Open Right (Restore)
            targetX = ACTION_WIDTH
            setIsOpen(true)
        } else if (currentX < -ACTION_WIDTH / 2) {
            // Open Left (Delete/Complete)
            targetX = -ACTION_WIDTH
            setIsOpen(true)
        } else {
            // Snap Closed
            targetX = 0
            setIsOpen(false)
        }

        animate(x, targetX, { type: "spring", stiffness: 500, damping: 30 })
    }

    // Dynamic transforms for background icons
    const leftOpacity = useTransform(x, [0, ACTION_WIDTH], [0, 1])
    const leftScale = useTransform(x, [0, ACTION_WIDTH], [0.5, 1])
    const rightOpacity = useTransform(x, [-ACTION_WIDTH, 0], [1, 0])
    const rightScale = useTransform(x, [-ACTION_WIDTH, 0], [1, 0.5])

    return (
        <div ref={containerRef} className="relative mb-2 h-14">
            {/* Background Actions Layer */}
            <div className="absolute inset-0 flex items-center justify-between px-4">
                {/* Left Action (Swiping Right) */}
                <motion.button
                    style={{ opacity: leftOpacity, scale: leftScale }}
                    onClick={() => {
                        onToggleComplete(index)
                        animate(x, 0)
                        setIsOpen(false)
                    }}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 z-0 pointer-events-auto",
                        item.completed ? "text-blue-400" : "text-emerald-400"
                    )}
                >
                    {item.completed ? <RotateCcw size={18} /> : <Check size={18} />}
                    <span className="text-[9px] font-bold uppercase tracking-wider">{item.completed ? "Restore" : "Done"}</span>
                </motion.button>

                {/* Right Action (Swiping Left) */}
                <motion.button
                    style={{ opacity: rightOpacity, scale: rightScale }}
                    onClick={() => {
                        if (item.completed) onRemove(index)
                        else onToggleComplete(index)
                        animate(x, 0)
                        setIsOpen(false)
                    }}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 z-0 pointer-events-auto",
                        item.completed ? "text-red-400" : "text-emerald-400"
                    )}
                >
                    {item.completed ? <Trash2 size={18} /> : <Check size={18} />}
                    <span className="text-[9px] font-bold uppercase tracking-wider">{item.completed ? "Delete" : "Done"}</span>
                </motion.button>
            </div>

            {/* Foreground Card */}
            <motion.div
                style={{ x }}
                drag="x"
                // Increase constraints to allow full swipe feel without elastic resistance too early
                dragConstraints={{ left: -1000, right: 1000 }}
                dragElastic={0.05} // Minimal resistance for "1:1" feel until extreme ends
                onDragEnd={handleDragEnd}
                className={cn(
                    "relative z-10 w-full h-full bg-card rounded-xl flex items-center gap-3 px-4 border shadow-sm transition-colors",
                    "border-white/10",
                    item.completed && "opacity-50 border-dashed border-white/5 bg-zinc-900/50"
                )}
            >
                {/* Quantity or Dot */}
                {item.quantity ? (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                        <span className="text-[9px] font-bold text-primary">{item.quantity}</span>
                    </div>
                ) : (
                    !item.completed && <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                )}

                <input
                    ref={inputRef}
                    value={item.content}
                    onChange={(e) => {
                        const val = e.target.value
                        const match = val.match(/(.*?)\s+(\d+x|x\d+)$/)
                        if (match) {
                            onUpdate(index, { content: match[1], quantity: match[2] })
                        } else {
                            onUpdate(index, { content: val })
                        }
                    }}
                    className={cn(
                        "flex-1 bg-transparent border-none outline-none text-[15px] font-medium py-1",
                        item.completed && "decoration-white/20" // Removed line-through
                    )}
                    placeholder="List item..."
                />
            </motion.div>
        </div>
    )
}

export default function OpenDocument() {
    const navigate = useNavigate()
    const { docId } = useParams()
    const userDocuments = useDocuments()
    const doc = userDocuments.getDocument(docId)

    const [title, setTitle] = useState('')
    const [content, setContent] = useState([]) // Array for lists, string for notes
    const [docMetadata, setDocMetadata] = useState({})
    const [showOptions, setShowOptions] = useState(false)
    const [lastAddedId, setLastAddedId] = useState(null)
    const optionsRef = useRef(null)

    const titleContainerRef = useRef(null)
    const [showLeftMask, setShowLeftMask] = useState(false)
    const [showRightMask, setShowRightMask] = useState(false)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (optionsRef.current && !optionsRef.current.contains(e.target)) {
                setShowOptions(false)
            }
        }
        if (showOptions) {
            window.document.addEventListener('mousedown', handleClickOutside)
        }
        return () => window.document.removeEventListener('mousedown', handleClickOutside)
    }, [showOptions])

    useEffect(() => {
        if (!doc && docId) {
            navigate('/browse')
        } else if (doc) {
            setTitle(doc.docTitle || '')
            setDocMetadata(doc.docMetadata || {})

            // Normalize content
            if (doc.docType === 'list') {
                if (typeof doc.docContent === 'string') {
                    setContent(doc.docContent.split('\n').filter(Boolean).map(c => ({
                        id: crypto.randomUUID(),
                        content: c,
                        completed: false,
                        quantity: ''
                    })))
                } else {
                    setContent(doc.docContent || [])
                }
            } else {
                setContent(doc.docContent || '')
            }
        }
    }, [doc, docId, navigate])

    const handleScroll = () => {
        if (titleContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = titleContainerRef.current
            setShowLeftMask(scrollLeft > 5)
            setShowRightMask(scrollLeft < scrollWidth - clientWidth - 5)
        }
    }

    useEffect(() => {
        handleScroll()
        window.addEventListener('resize', handleScroll)
        return () => window.removeEventListener('resize', handleScroll)
    }, [title])

    const syncChanges = (modifications) => {
        userDocuments.modifyDocument(docId, modifications)
    }

    const handleTitleChange = (e) => {
        const newTitle = e.target.value
        setTitle(newTitle)
        syncChanges({ docTitle: newTitle })
    }

    const handleNoteChange = (e) => {
        const val = e.target.value
        setContent(val)
        syncChanges({ docContent: val })
    }

    // List Actions
    const addListItem = () => {
        const id = crypto.randomUUID()
        const newItem = { id, content: '', completed: false, quantity: '' }
        const newContent = [newItem, ...content]
        setLastAddedId(id)
        setContent(newContent)
        syncChanges({ docContent: newContent })
    }

    const updateListItem = (index, updates) => {
        const newContent = [...content]
        newContent[index] = { ...newContent[index], ...updates }
        setContent(newContent)
        syncChanges({ docContent: newContent })
    }

    const toggleListItem = (index) => {
        const newContent = [...content]
        newContent[index].completed = !newContent[index].completed
        setContent(newContent)
        syncChanges({ docContent: newContent })
    }

    const removeListItem = (index) => {
        const newContent = content.filter((_, i) => i !== index)
        setContent(newContent)
        syncChanges({ docContent: newContent })
    }

    const toggleListType = () => {
        const newMetadata = { ...docMetadata, listType: docMetadata.listType === 'grocery' ? 'normal' : 'grocery' }
        setDocMetadata(newMetadata)
        syncChanges({ docMetadata: newMetadata })
        setShowOptions(false) // Close popover
    }

    const todoItems = useMemo(() => Array.isArray(content) ? content.filter(i => !i.completed) : [], [content])
    const completedItems = useMemo(() => Array.isArray(content) ? content.filter(i => i.completed) : [], [content])

    if (!doc) return null

    return (
        <div className="min-h-dvh flex flex-col pt-[max(48px,env(safe-area-inset-top))] px-6 pb-40 max-w-4xl mx-auto w-full relative">
            <header className="mb-8 flex items-center justify-between">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium cursor-pointer"
                >
                    <ChevronLeft size={16} /> Back
                </button>

                <div className="relative">
                    <button
                        onClick={() => setShowOptions(!showOptions)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all active:scale-95",
                            doc?.docType === 'list'
                                ? "bg-primary/10 border-primary/20 text-primary font-bold"
                                : "bg-zinc-800 border-white/5 text-muted-foreground font-medium"
                        )}
                    >
                        {docMetadata.listType === 'grocery' && <Apple size={14} />}
                        <span className="text-[10px] uppercase tracking-wider">
                            {doc?.docType === 'list' ? 'Edit List' : doc?.docType.toUpperCase()}
                        </span>
                        {doc?.docType === 'list' && <Settings size={12} className="opacity-50" />}
                    </button>

                    <AnimatePresence>
                        {showOptions && doc?.docType === 'list' && (
                            <motion.div
                                ref={optionsRef}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="absolute right-0 top-full mt-2 z-50 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl min-w-[240px]"
                            >
                                <button
                                    onClick={toggleListType}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-sm font-medium"
                                >
                                    <Apple size={18} className={cn(docMetadata.listType === 'grocery' ? "text-emerald-400" : "text-muted-foreground")} />
                                    <div className="text-left flex-1">
                                        <div className="text-sm">Grocery List Mode</div>
                                        <div className="text-[10px] opacity-40">Themed icons & smart quantities</div>
                                    </div>
                                    {docMetadata.listType === 'grocery' && <Check size={14} className="text-primary" />}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </header>

            <div className="flex-1 flex flex-col gap-8">
                {/* Title Section */}
                <div className="relative shrink-0">
                    <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-12 bg-linear-to-r from-background via-background/40 to-transparent z-10 pointer-events-none transition-opacity",
                        showLeftMask ? "opacity-100" : "opacity-0"
                    )} />
                    <div className={cn(
                        "absolute right-0 top-0 bottom-0 w-12 bg-linear-to-l from-background via-background/40 to-transparent z-10 pointer-events-none transition-opacity",
                        showRightMask ? "opacity-100" : "opacity-0"
                    )} />

                    <div
                        ref={titleContainerRef}
                        onScroll={handleScroll}
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        className="overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth px-2 py-1"
                    >
                        <input
                            value={title}
                            onChange={handleTitleChange}
                            className="text-4xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/10 min-w-full"
                            placeholder="Document Title"
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col no-scrollbar">
                    {doc?.docType === "list" ? (
                        <div className="space-y-10">
                            {/* Todo Section */}
                            <div className="flex flex-col">
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {todoItems.length > 0 ? content.map((item, idx) => !item.completed && (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                        >
                                            <ListItem
                                                item={item}
                                                index={idx}
                                                isNew={item.id === lastAddedId}
                                                onUpdate={updateListItem}
                                                onRemove={removeListItem}
                                                onToggleComplete={toggleListItem}
                                            />
                                        </motion.div>
                                    )) : (
                                        <div className="text-center py-16 flex flex-col items-center gap-3">
                                            <p className="text-sm font-medium text-muted-foreground italic opacity-50">No items left</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Completed Section */}
                            {completedItems.length > 0 && (
                                <div className="pt-8 border-t border-white/5">
                                    <div className="flex items-center justify-between px-2 mb-4">
                                        <div className="flex flex-col">
                                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
                                                Completed
                                            </h3>
                                            <span className="text-[9px] font-medium text-muted-foreground/20">
                                                {completedItems.length} of {content.length} items · {Math.round((completedItems.length / content.length) * 100)}% done
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <AnimatePresence mode="popLayout" initial={false}>
                                            {content.map((item, idx) => item.completed && (
                                                <motion.div
                                                    key={item.id}
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <ListItem
                                                        item={item}
                                                        index={idx}
                                                        onUpdate={updateListItem}
                                                        onRemove={removeListItem}
                                                        onToggleComplete={toggleListItem}
                                                    />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Textarea
                            value={content}
                            onChange={handleNoteChange}
                            placeholder="Start writing..."
                            className="text-xl leading-relaxed p-0 min-h-[500px] border-none focus-visible:ring-0 bg-transparent resize-none"
                        />
                    )}
                </div>
            </div>

            {doc?.docType === 'list' && (
                <button
                    onClick={addListItem}
                    className="fixed bottom-28 right-8 w-14 h-14 rounded-full bg-primary text-white shadow-[0_8px_30px_rgb(59,130,246,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-100 group"
                >
                    <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            )}
        </div>
    )
}
