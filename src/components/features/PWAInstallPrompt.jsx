import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, PlusSquare, ArrowUp, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [shouldBounce, setShouldBounce] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (isStandalone) return;

        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);

        // ONLY show if iOS and NOT standalone
        if (ios) {
            setShowPrompt(true);
            // Delay bounce by 10 seconds
            const bounceTimer = setTimeout(() => setShouldBounce(true), 10000);
            return () => clearTimeout(bounceTimer);
        }
    }, []);

    if (!showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-between p-8 text-center overflow-hidden"
            >
                {/* Background Glows (Optimized for Safari) */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none transform-gpu" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full pointer-events-none transform-gpu" />

                {/* Top Guide Indicator (Main for Chrome iOS / iPad / newer iOS) */}
                <div className={cn(
                    "absolute top-8 right-8 flex flex-col items-center opacity-90 z-[210] transition-transform duration-500",
                    shouldBounce ? "animate-bounce" : "scale-90 opacity-40"
                )}>
                    <ArrowUp className="text-primary w-10 h-10 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary mt-2">Tap Share</span>
                </div>

                {/* Main Content - Moved up by 20px via mt-[-20px] or adjustment */}
                <div className="flex-1 flex flex-col items-center justify-center max-w-sm w-full space-y-12 -mt-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full transform-gpu scale-125" />
                        <div className="relative w-24 h-24 bg-black border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl">
                            <Brain size={48} className="text-primary" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold tracking-tight text-white leading-tight">
                            Pocket <span className="text-primary">Memory</span>
                        </h1>
                        <p className="text-muted-foreground text-lg leading-relaxed px-4">
                            Your second brain, now ready for your Home Screen.
                        </p>
                    </div>

                    <div className="w-full bg-secondary/30 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-8 transform-gpu">
                        <div className="flex items-center gap-6 text-left">
                            <div className="flex-shrink-0 w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                                <Share className="text-blue-400 w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-bold text-white uppercase tracking-wider">Step 1</div>
                                <div className="text-sm text-white/70 leading-snug">
                                    Tap the <span className="text-white font-medium">Share</span> button above
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-white/5" />

                        <div className="flex items-center gap-6 text-left">
                            <div className="flex-shrink-0 w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                                <PlusSquare className="text-gray-400 w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm font-bold text-white uppercase tracking-wider">Step 2</div>
                                <div className="text-sm text-white/70 leading-snug">
                                    Scroll down and select <span className="text-white font-medium">Add to Home Screen</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
