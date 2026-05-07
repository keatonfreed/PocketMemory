import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Edit3, ExternalLink, Search, Sparkles, Trash2 } from 'lucide-react'
import useCaptureRequests from '@/hooks/useCaptureRequests'
import { cn } from '@/lib/utils'

export default function CaptureStatusPills({ floating = false }) {
    const requests = useCaptureRequests(state => state.requests)

    const icons = {
        progress: <Search size={14} className="animate-pulse" />,
        captured: <Sparkles size={14} />,
        changed: <Edit3 size={14} />,
        deleted: <Trash2 size={14} />,
        opened: <ExternalLink size={14} />,
        failed: <AlertCircle size={14} />,
    }

    if (!requests.length) return null

    return (
        <div className={cn(
            "flex flex-col items-center gap-1.5 pointer-events-none z-[60] overflow-visible",
            floating ? "absolute top-4 left-0 right-0 px-4" : "mt-3"
        )}>
            <AnimatePresence mode="popLayout" initial={false}>
                {requests.map((request) => (
                    <motion.div
                        key={request.id}
                        layout
                        initial={{ opacity: 0, y: -4, scale: 0.98, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, scale: 0.98, y: -4, filter: "blur(6px)" }}
                        transition={{ layout: { duration: 0.16, ease: "easeOut" }, opacity: { duration: 0.14 }, y: { duration: 0.16 }, scale: { duration: 0.16 }, filter: { duration: 0.16 } }}
                        className={cn(
                            "max-w-[min(92vw,420px)] min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-md border shadow-lg transition-all whitespace-nowrap",
                            request.type === 'failed'
                                ? "bg-red-500/12 border-red-400/25 text-red-200"
                                : request.type === 'progress'
                                    ? "bg-primary/10 border-primary/20 text-primary/80"
                                    : "bg-zinc-900/80 border-white/5 text-primary"
                        )}
                    >
                        <span className="shrink-0 opacity-80">{icons[request.type] || icons.progress}</span>
                        <span className="min-w-0 truncate">{request.message}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
