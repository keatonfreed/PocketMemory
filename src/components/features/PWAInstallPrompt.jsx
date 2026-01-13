import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, PlusSquare, X } from 'lucide-react';

export default function PWAInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

        if (isStandalone) return;

        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        // Show prompt if not standalone
        // Delay slightly for effect
        setTimeout(() => setShowPrompt(ios), 1000);
    }, []);

    if (!showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-end pb-12 px-6"
            >
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 relative shadow-2xl"
                >
                    <button
                        onClick={() => setShowPrompt(false)}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                            <img src="/icon-192.png" alt="App Icon" className="w-full h-full rounded-2xl object-cover" />
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-white tracking-wide">Install Pocket Memory</h3>
                            <p className="text-sm text-white/60 leading-relaxed">
                                Add to your home screen for the best experience.
                            </p>
                        </div>

                        {isIOS ? (
                            <div className="w-full bg-white/5 rounded-xl p-4 text-sm text-white/80 space-y-3 mt-2 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Share size={20} className="text-blue-400" />
                                    <span>Tap the <span className="font-bold text-white">Share</span> button</span>
                                </div>
                                <div className="h-px bg-white/10 w-full" />
                                <div className="flex items-center gap-3">
                                    <PlusSquare size={20} className="text-gray-400" />
                                    <span>Select <span className="font-bold text-white">Add to Home Screen</span></span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-white/50 italic">
                                Tap the menu button and select "Add to Home Screen"
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
