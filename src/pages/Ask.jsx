import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import StickyNav from '@/components/layout/StickyNav'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import useMemoryStore from '@/hooks/useMemoryStore'
import { askQuestionStream } from '@/lib/ai'

const StreamingText = ({ content }) => {
    // Split content into words, preserving spaces
    const words = content.split(/(\s+)/);

    return (
        <span className="inline-block">
            {words.map((word, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.95, y: 2 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                >
                    {word}
                </motion.span>
            ))}
        </span>
    )
}

export default function Ask() {
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Accessing neural link... What do you need to know?" }
    ])
    const [isTyping, setIsTyping] = useState(false)
    const [showTopFade, setShowTopFade] = useState(false)
    const [showBottomFade, setShowBottomFade] = useState(false)

    const searchMemories = useMemoryStore(state => state.searchMemories)
    const scrollRef = useRef(null)
    const listRef = useRef(null)

    // Track message count to detect "New" messages vs "Updating" messages
    const prevMsgCount = useRef(messages.length)
    // Track if we are reading the latest (at bottom) or history (scrolled up)
    const isAtBottomRef = useRef(true)

    useEffect(() => {
        // Sticky Scroll Logic
        const isNewMessage = messages.length > prevMsgCount.current
        prevMsgCount.current = messages.length

        // If it's a fresh message (User send / AI start), we force focus to it.
        // OR if the user was already sitting at the bottom, we keep them there as text generates.
        if (isNewMessage || isAtBottomRef.current) {
            scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [messages, isTyping]);

    // Check scroll position to toggle fades & sticky state
    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target
        setShowTopFade(scrollTop > 10)

        const distanceToBottom = scrollHeight - scrollTop - clientHeight
        setShowBottomFade(distanceToBottom > 10)

        // Sticky Logic:
        // We consider the user "At Bottom" if they are within a tight threshold (40px).
        // If they scroll up further than that, we assume they want to read history,
        // so we uncheck this flag to stop auto-scrolling.
        isAtBottomRef.current = distanceToBottom < 40
    }

    const handleSend = async () => {
        if (!input.trim()) return
        const userMsg = input
        setInput('')

        // Add User Message
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])

        // Start "Thinking"
        setIsTyping(true)

        // Create context
        const relevant = searchMemories(userMsg)

        // Prepare for AI response
        // Note: We don't add the message yet to avoid an empty box. 
        // We wait for the first chunk to replace the loading indicator.

        // Create the new history including the user's latest message
        const newHistory = [...messages, { role: 'user', content: userMsg }]

        try {
            const stream = askQuestionStream(newHistory, relevant)

            let fullContent = ""
            let isFirstChunk = true

            for await (const chunk of stream) {
                fullContent += chunk

                if (isFirstChunk) {
                    setIsTyping(false) // Stop "thinking" bubbles
                    isFirstChunk = false
                    // Create the AI message now that we have content
                    setMessages(prev => [...prev, { role: 'assistant', content: fullContent }])
                } else {
                    // Update the existing last message
                    setMessages(prev => {
                        const newHistory = [...prev]
                        const lastMsg = newHistory[newHistory.length - 1]
                        if (lastMsg.role === 'assistant') {
                            lastMsg.content = fullContent
                        }
                        return newHistory
                    })
                }
            }
        } catch (err) {
            console.error(err)
            setIsTyping(false)
        }
    }

    return (
        <div className="min-h-screen max-h-full flex flex-col pt-6 px-4 pb-32 relative overflow-hidden">
            <header className="flex justify-center mb-6 border-b border-white/5 pb-4 shrink-0">
                <div className="uppercase tracking-[0.2em] text-[10px] text-primary font-bold flex items-center gap-2">
                    <Sparkles size={12} /> Neural Interface
                </div>
            </header>

            {/* Message Container Area */}
            <div
                className="flex-1 relative h-full overflow-hidden ">
                {/* Top Fade Mask */}
                <div className={cn(
                    "absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-500",
                    showTopFade ? "opacity-100" : "opacity-0"
                )} />

                {/* Bottom Fade Mask */}
                <div className={cn(
                    "absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none transition-opacity duration-500",
                    showBottomFade ? "opacity-100" : "opacity-0"
                )} />

                <div
                    ref={listRef}
                    onScroll={handleScroll}
                    className='absolute inset-0 h-full max-h-full overflow-y-scroll no-scrollbar space-y-6 px-2 pb-4'>

                    {messages.map((msg, i) => (
                        <div key={i} className={cn("flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2", msg.role === 'user' ? "items-end" : "items-start")}>
                            <div className={cn("max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-sm border",
                                msg.role === 'assistant'
                                    ? "bg-card/80 border-white/5 text-muted-foreground rounded-tl-none"
                                    : "bg-primary/20 border-primary/20 text-foreground rounded-tr-none"
                            )}>
                                {msg.role === 'assistant' ? (
                                    <StreamingText content={msg.content} />
                                ) : (
                                    msg.content
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground/30 uppercase tracking-widest px-1">
                                {msg.role === 'assistant' ? 'AI' : 'YOU'}
                            </span>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex flex-col gap-2 items-start animate-in fade-in">
                            <div className="bg-card/80 p-4 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} className="h-4" />
                </div>
            </div>

            <div className="h-fit left-0 w-full px-4 z-40 pointer-events-none">
                <div className="max-w-md mx-auto pointer-events-auto relative mt-4">
                    <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full" />
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Ask..."
                        className="relative z-10 w-full bg-black/80 border border-white/10 rounded-full py-4 pl-6 pr-14 outline-none focus:border-primary/50 transition-all text-sm placeholder:text-muted-foreground/30 shadow-2xl backdrop-blur-xl"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-white rounded-full disabled:opacity-0 hover:scale-105 transition-all z-20 shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    )
}
