import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { queryMemory } from '@/lib/ai'
import useDocuments from '@/hooks/useDocuments'
import { Sparkles, ArrowUp, Mic, Search, Check, Trash, Trash2, Edit3, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid' // using crypto in store, but good to have handy if needed. we'll use optimistic updates.

export default function CaptureBox() {
    const navigate = useNavigate()

    const [input, setInput] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [animKey, setAnimKey] = useState(0)
    const [triggerAnim, setTriggerAnim] = useState(false)
    const [introSequence, setIntroSequence] = useState(true) // Track initial load state
    const [isListening, setIsListening] = useState(false)
    const [notifications, setNotifications] = useState([]) // Array of { id, message, type, icon, docId? }

    const recognitionRef = React.useRef(null)
    const inputRef = React.useRef(input) // Keep track of latest input
    const isListeningRef = React.useRef(false)
    const triggerDuration = React.useRef(2000)

    useEffect(() => {
        inputRef.current = input
    }, [input])

    // STT Initialization
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognitionRef.current = recognition;

        let baseInputOnStart = "";

        recognition.onstart = () => {
            baseInputOnStart = inputRef.current;
            setIsListening(true);
            isListeningRef.current = true;
        };

        recognition.onresult = (event) => {
            if (!isListeningRef.current) return;

            let interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript || interimTranscript) {
                const newText = baseInputOnStart + (baseInputOnStart ? " " : "") + finalTranscript + interimTranscript;
                setInput(newText);
            }

            if (finalTranscript) {
                baseInputOnStart += (baseInputOnStart ? " " : "") + finalTranscript;
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            isListeningRef.current = false;
        };

        recognition.onerror = (event) => {
            if (event.error === 'no-speech') return;
            console.error("Speech Recognition Error", event.error);
            setIsListening(false);
            isListeningRef.current = false;
        };

        const handleVisibilityChange = () => {
            if (document.hidden && isListeningRef.current) {
                recognition.stop();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            recognition.stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const stopListening = () => {
        if (recognitionRef.current && isListeningRef.current) {
            isListeningRef.current = false; // Immediate flag change to ignore late results
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            try {
                recognitionRef.current.start();
                // isListening/isListeningRef will be set in onstart
                setIsFocused(true); // Focus textarea when starting to speak
            } catch (err) {
                console.error("Recognition start failed", err);
            }
        }
    };

    // Track if the border is currently visible (opacity > 0)
    // This prevents resetting the rotation angle if we focus while it's still fading out
    const isVisibleRef = React.useRef(false)
    const visibilityTimer = React.useRef(null)

    const userDocuments = useDocuments()

    // Visibility Tracking Effect
    useEffect(() => {
        // If we represent "Visual Presence" (Focused or Pulsing)
        if (isFocused || triggerAnim) {
            isVisibleRef.current = true
            if (visibilityTimer.current) clearTimeout(visibilityTimer.current)
        } else {
            // We are fading out. How long until we are truly gone?
            // Matches CSS logic: Intro=1500ms, Normal=500ms
            const duration = introSequence ? 1500 : 500

            if (visibilityTimer.current) clearTimeout(visibilityTimer.current)
            visibilityTimer.current = setTimeout(() => {
                isVisibleRef.current = false
            }, duration)
        }

        return () => {
            if (visibilityTimer.current) clearTimeout(visibilityTimer.current)
        }
    }, [isFocused, triggerAnim, introSequence])

    // Auto-fade logic: Trigger set to true on focus, then immediately false to start decay
    useEffect(() => {
        if (triggerAnim) {
            const timer = setTimeout(() => setTriggerAnim(false), triggerDuration.current);
            return () => clearTimeout(timer);
        }
    }, [triggerAnim]);

    // Initial Load Animation
    useEffect(() => {
        // slight delay to ensure render is ready
        const timer = setTimeout(() => {
            triggerDuration.current = 800 // Shorter pulsing hold for initial load
            setTriggerAnim(true)
            // Initial load always resets key (it's the start)
            setAnimKey(prev => prev + 1)

            // Turn off intro sequence after the pulse (800ms) + slow fade out (2000ms)
            setTimeout(() => setIntroSequence(false), 2800)
        }, 100)
        return () => clearTimeout(timer)
    }, [])

    const addNotification = (message, type, { docId = null, requestId = null } = {}) => {
        const id = uuidv4()
        const icons = {
            progress: <Search size={14} className="animate-pulse" />,
            captured: <Sparkles size={14} />,
            changed: <Edit3 size={14} />,
            deleted: <Trash2 size={14} />,
            opened: <ExternalLink size={14} />,
            failed: <AlertCircle size={14} />
        }

        setNotifications(prev => {
            const nextNotification = {
                id,
                message,
                type,
                icon: icons[type],
                docId,
                requestId,
                onClick: docId ? () => navigate(`/document/${docId}`) : null
            }

            // Priority 1: If it's a progress/final update for the same REQUEST, replace it
            if (requestId) {
                const existingIndex = prev.findIndex(n => n.requestId === requestId)
                if (existingIndex !== -1) {
                    const next = [...prev]
                    next[existingIndex] = nextNotification
                    return next
                }
            }

            // Priority 2: If it's a progress update for the same docId, replace it
            if (docId && type === 'progress') {
                const existingIndex = prev.findIndex(n => n.docId === docId && n.type === 'progress')
                if (existingIndex !== -1) {
                    const next = [...prev]
                    next[existingIndex] = nextNotification
                    return next
                }
            }

            // Prepend new notifications (newest on top)
            return [nextNotification, ...prev]
        })

        // Auto-remove final states after delay
        if (type !== 'progress') {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id))
            }, 3000)
        }
        return id
    }


    const removeNotificationByDocId = (docId, type) => {
        setNotifications(prev => prev.filter(n => !(n.docId === docId && n.type === type)))
    }

    const handleKeyDown = async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!input.trim() && !isListening) return

            setIsProcessing(true)

            // If we are listening, wait a tiny bit to catch any final results before grabbing state
            if (isListening) {
                stopListening()
                await new Promise(r => setTimeout(r, 600))
            }

            // 1. Prepare Request
            const requestId = uuidv4()
            const inputContent = inputRef.current
            if (!inputContent.trim()) {
                setIsProcessing(false)
                return
            }

            setInput('')
            setIsFocused(false) // Unfocus to show feed

            // 2. Async AI Analysis
            try {
                let context = userDocuments.getDocuments()
                context = context.map(m => ({
                    docId: m.docId,
                    docTitle: m.docTitle,
                    docSummary: m.docSummary,
                    docTags: m.docTags,
                    docType: m.docType,
                }))

                const stream = queryMemory(inputContent, context)

                for await (const event of stream) {
                    if (event.type === 'progress') {
                        addNotification(event.message, 'progress', { docId: event.docId, requestId })
                    } else if (event.type === 'final') {

                        const data = event.data
                        console.log("Query Memory Final Response:", data);

                        if (data?.actions) {
                            data.actions.forEach(action => {
                                // Clear progress for this document if it exists
                                if (action.actionPayload?.docId) {
                                    removeNotificationByDocId(action.actionPayload.docId, 'progress')
                                }

                                switch (action.actionType) {
                                    case "createDocument":
                                        const newDocId = crypto.randomUUID()
                                        userDocuments.createDocument({
                                            docId: newDocId,
                                            docTitle: action.actionPayload.docTitle,
                                            docContent: action.actionPayload.docContent,
                                            docSummary: action.actionPayload.docSummary,
                                            docTags: action.actionPayload.docTags,
                                            docType: action.actionPayload.docType,
                                            createdAt: new Date().toISOString(),
                                            updatedAt: new Date().toISOString(),
                                        })
                                        addNotification("CAPTURED", 'captured', { docId: newDocId, requestId })
                                        break;
                                    case "modifyDocument":
                                        userDocuments.modifyDocument(action.actionPayload.docId, action.actionPayload)
                                        addNotification("CHANGED", 'changed', { docId: action.actionPayload.docId, requestId })
                                        break;
                                    case "deleteDocument":
                                        userDocuments.deleteDocument(action.actionPayload.docId)
                                        addNotification("DELETED", 'deleted', { docId: action.actionPayload.docId, requestId })
                                        break;
                                    case "openDocument":
                                        navigate(`/document/${action.actionPayload.docId}`)
                                        addNotification("OPENED", 'opened', { docId: action.actionPayload.docId, requestId })
                                        break;
                                    default:
                                        console.warn("Unknown action type:", action.actionType);
                                        addNotification("FAILED", 'failed', { requestId })
                                }
                            })
                        } else {
                            // If no actions, and we finished progress, clear this requestId
                            setNotifications(prev => prev.filter(n => n.requestId !== requestId))
                        }
                    }
                }
            } catch (err) {
                console.error("AI Failed", err)
                setNotifications(prev => prev.filter(n => n.requestId !== requestId))
                addNotification("AI FAILED", 'failed', { requestId })
            } finally {
                setIsProcessing(false)
            }



        }
    }

    return (
        <div className="relative w-full mb-10 z-20 group">
            {/* 
                Glow Background 
                - Active (Focus/Pulse): Fast transition (500ms) for responsiveness
                - Intro Exit: Slow graceful fade (2.5s)
                - Normal Exit: Fast fade (500ms)
            */}
            <div className={cn(
                "absolute -inset-1 -inset-x-[5px] rounded-2xl bg-linear-to-r from-primary via-cyan-500 to-primary opacity-0 blur-lg transition-opacity ease-in-out",
                // Opacity Logic:
                // 1. Focused OR Work Pulse: Full brightness (30%)
                // 2. Intro Pulse: Half brightness (15%) for subtle element entry
                // 3. Resting: Hidden (0%)
                isFocused || (triggerAnim && !introSequence) ? "opacity-60" : (triggerAnim && introSequence ? "opacity-30" : "opacity-0"),

                // Dynamic Duration Logic:
                // If active (showing), always fast (500ms) to appear snappy.
                // If fading out (hiding) AND in intro, slow (2500ms).
                // Else (hiding normal), fast (500ms).
                (isFocused || triggerAnim) ? "duration-500" : (introSequence ? "duration-[2500ms]" : "duration-500")
            )} >
                <div className='absolute -inset-10 '></div>
            </div>
            <div className={cn(
                "absolute top-0 bottom-0 w-[20%] rounded-2xl bg-linear-to-b from-cyan-500 via-primary to-cyan-500 opacity-0 blur-lg transition-opacity ease-in-out animate-[blur-shake_3000ms_cubic-bezier(0.35,_0,_0.65,_1)_infinite,blur-rotate_600ms_linear_infinite_alternate]",
                // Opacity Logic:
                // 1. Focused OR Work Pulse: Full brightness (30%)
                // 2. Intro Pulse: Half brightness (15%) for subtle element entry
                // 3. Resting: Hidden (0%)
                isFocused || (triggerAnim && !introSequence) ? "opacity-15" : (triggerAnim && introSequence ? "opacity-15" : "opacity-0"),

                // Dynamic Duration Logic:
                // If active (showing), always fast (500ms) to appear snappy.
                // If fading out (hiding) AND in intro, slow (2500ms).
                // Else (hiding normal), fast (500ms).
                (isFocused || triggerAnim) ? "duration-500" : (introSequence ? "duration-[1000ms]" : "duration-500")
            )} />
            <div className={cn(
                "absolute top-0 bottom-0 w-[20%] rounded-2xl bg-linear-to-b from-cyan-500 via-primary to-cyan-500 opacity-0 blur-lg transition-opacity ease-in-out animate-[blur-shake_3000ms_cubic-bezier(0.35,_0,_0.65,_1)_infinite_1500ms,blur-rotate_600ms_linear_infinite_alternate_300ms]",
                // Opacity Logic:
                // 1. Focused OR Work Pulse: Full brightness (30%)
                // 2. Intro Pulse: Half brightness (15%) for subtle element entry
                // 3. Resting: Hidden (0%)
                isFocused || (triggerAnim && !introSequence) ? "opacity-15" : (triggerAnim && introSequence ? "opacity-15" : "opacity-0"),

                // Dynamic Duration Logic:
                // If active (showing), always fast (500ms) to appear snappy.
                // If fading out (hiding) AND in intro, slow (2500ms).
                // Else (hiding normal), fast (500ms).
                (isFocused || triggerAnim) ? "duration-500" : (introSequence ? "duration-[1000ms]" : "duration-500")
            )} />
            <div className={cn(
                "absolute top-0 bottom-0 w-[20%] rounded-2xl bg-linear-to-b from-cyan-500 via-primary to-cyan-500 opacity-0 blur-lg transition-opacity ease-in-out animate-[blur-shake_2700ms_cubic-bezier(0.35,_0,_0.65,_1)_infinite_1000ms,blur-rotate_600ms_linear_infinite_alternate_300ms]",
                // Opacity Logic:
                // 1. Focused OR Work Pulse: Full brightness (30%)
                // 2. Intro Pulse: Half brightness (15%) for subtle element entry
                // 3. Resting: Hidden (0%)
                isFocused || (triggerAnim && !introSequence) ? "opacity-15" : (triggerAnim && introSequence ? "opacity-15" : "opacity-0"),

                // Dynamic Duration Logic:
                // If active (showing), always fast (500ms) to appear snappy.
                // If fading out (hiding) AND in intro, slow (2500ms).
                // Else (hiding normal), fast (500ms).
                (isFocused || triggerAnim) ? "duration-500" : (introSequence ? "duration-[1000ms]" : "duration-500")
            )} />

            <motion.div
                className="relative rounded-2xl bg-black overflow-hidden border-none"
                animate={{ scale: isFocused ? 1.02 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
                {/* Animated Border Mask */}
                <div className={cn(
                    "absolute inset-0 z-0 overflow-hidden rounded-2xl flex items-center justify-center transition-opacity ease-out",
                    // Logic:
                    // 1. Trigger (Start): Opacity 100, Instant duration (Jump to visible)
                    // 2. Focused (Decay): Opacity 30, Slow duration (3s fade out to visible glow)
                    // 3. Intro (First Load): Opacity 0, Medium duration (1.5s) for nice intro fade
                    // 4. Blurred (Normal Exit): Opacity 0, Fast duration (500ms) for snappy UI
                )}>
                    {/* Under Solid Border */}
                    <div
                        key={`solid`}
                        className={cn("absolute w-[150%] aspect-square transition-[opacity,background] ease-out duration-500  bg-border", triggerAnim || isFocused
                            ? "opacity-70"
                            : "opacity-100")}
                    />

                    {/* Primary Slow Beam (Blue) */}
                    <div
                        key={`beam1-${animKey}`}
                        className={cn("absolute w-[150%] aspect-square animate-[spin_3s_linear_infinite]", triggerAnim
                            ? "opacity-100 duration-0"
                            : isFocused
                                ? "opacity-70 duration-[3000ms]"
                                : introSequence ? "opacity-0 duration-[1500ms]" : "opacity-0 duration-500")}
                        style={{
                            background: `conic-gradient(from 0deg, 
                                transparent 0deg, 
                                var(--color-primary) 60deg,
                                transparent 100deg
                            )`
                        }}
                    />

                    {/* Secondary Fast Beam (Lighter Blue) - Same direction, wider, catching up */}
                    <div
                        key={`beam2-${animKey}`}
                        className={cn("absolute w-[150%] aspect-square animate-[spin_2s_linear_infinite] mix-blend-plus-lighter opacity-60", triggerAnim
                            ? "opacity-100 duration-0"
                            : isFocused
                                ? "opacity-70 duration-[3000ms]"
                                : introSequence ? "opacity-0 duration-[1500ms]" : "opacity-0 duration-500")}
                        style={{
                            background: `conic-gradient(from 180deg, 
                                transparent 0deg, 
                                #60a5fa 45deg,
                                transparent 90deg
                            )`
                        }}
                    />
                </div>

                {/* Inner Content Surface - Increased margin for thicker border */}
                <div className="relative z-10 m-[2px] bg-card rounded-[15px] p-1 h-full min-h-[120px] flex flex-col ">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onFocus={() => {
                            // User Interaction override:
                            // Cancel any running intro logic immediately to ensure responsiveness
                            setIntroSequence(false)
                            setIsFocused(true)

                            triggerDuration.current = 1500 // Longer pulse for manual focus
                            setTriggerAnim(true)

                            // Only reset the spin IF the border is not currently visible
                            // This prevents jump-cuts if we focus while it's still fading out
                            if (!isVisibleRef.current) {
                                setAnimKey(prev => prev + 1)
                            }
                            // Else: Reuse the existing key/spin, just snap opacity back to 100
                        }}
                        onBlur={() => {
                            setIsFocused(false)
                            setTriggerAnim(false) // Kill the "Pulse Hold" immediately on defocus
                        }}
                        onKeyDown={handleKeyDown}
                        className="flex-1 w-full bg-transparent border-none outline-none resize-none text-lg p-3 placeholder:text-muted-foreground/40 font-light"
                        placeholder="Capture anything..."
                    />

                    <div className="flex justify-between items-center px-2 pb-2">
                        <div className="flex gap-2"></div>

                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={toggleListening}
                                className={cn(
                                    "w-11 h-11 rounded-full transition-all duration-500 flex items-center justify-center relative shrink-0",
                                    isListening
                                        ? "bg-primary text-white scale-110 shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                                        : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 transform-gpu safari-blur-fix"
                                )}
                            >
                                {isListening && (
                                    <motion.div
                                        layoutId="mic-pulse"
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1.4, opacity: 0.3 }}
                                        transition={{
                                            repeat: Infinity,
                                            duration: 1.5,
                                            ease: "easeOut"
                                        }}
                                        className="absolute inset-0 rounded-full bg-primary"
                                    />
                                )}
                                <Mic size={20} className={cn(isListening && "text-white")} />
                            </button>

                            <button
                                disabled={!input.trim() && !isListening}
                                onClick={() => handleKeyDown({ key: 'Enter', preventDefault: () => { } })}
                                className={cn(
                                    "w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center shrink-0",
                                    (input.trim() || isListening)
                                        ? "bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-100"
                                        : "bg-zinc-800 text-zinc-600 scale-95"
                                )}
                            >
                                {isProcessing ? (
                                    <Sparkles size={20} className="animate-spin text-white" />
                                ) : <ArrowUp size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stacked Notifications Feed */}
            <div className="absolute top-full mt-4 left-0 right-0 flex flex-col items-center gap-1.5 pointer-events-none z-50">
                <AnimatePresence mode="popLayout" initial={false}>
                    {notifications.map((n) => (
                        <motion.div
                            key={n.id}
                            layout
                            onClick={n.onClick}
                            initial={{ opacity: 0, y: -5, scale: 0.95, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0.95, y: -5, filter: "blur(4px)", transition: { duration: 0.2 } }}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border shadow-lg transition-all",
                                n.onClick && "cursor-pointer pointer-events-auto active:scale-95 hover:bg-white/5",
                                n.type === 'progress'
                                    ? "bg-primary/10 border-primary/20 text-primary/80"
                                    : "bg-zinc-900/80 border-white/5 text-primary"
                            )}
                        >
                            <span className="shrink-0 opacity-80">{n.icon}</span>
                            <span>{n.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>


        </div>
    )
}

