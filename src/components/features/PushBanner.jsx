import React, { useState, useEffect } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { enablePush } from '@/lib/push';

export default function PushBanner() {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Safe check for Notification API (might be missing in non-PWA iOS Chrome)
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            setVisible(true);
        }
    }, []);

    const handleEnable = async () => {
        setLoading(true);
        try {
            await enablePush();
            setVisible(false);
        } catch (err) {
            console.error("Failed to enable push:", err);
            // Optionally show an error toast here
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        setVisible(false);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="relative bg-primary/10 border-b border-primary/20 overflow-hidden"
                >
                    <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-primary/20 rounded-full text-primary">
                                <Bell size={14} />
                            </div>
                            <div className="text-xs font-medium text-primary-foreground">
                                Enable notifications for reminders?
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleEnable}
                                disabled={loading}
                                className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full hover:brightness-110 transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 size={12} className="animate-spin" /> : 'Connect'}
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1 text-primary/60 hover:text-primary transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
