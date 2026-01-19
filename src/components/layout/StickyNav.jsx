import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Brain, Layers, MessageSquare, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StickyNav() {
    const location = useLocation();

    const isLinkActive = (path) => {
        return location.pathname === path;
    }

    return (
        <div className="absolute bottom-0 left-0 w-full z-50 pb-8 pt-12 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
            <div className="px-6 pointer-events-auto">
                <nav className="flex justify-center items-center gap-12">
                    {/* Left: Browse/Layers */}
                    <NavLink
                        to="/browse"
                        className="w-16 h-16 flex items-center justify-center transition-all duration-300 group"
                    >
                        {({ isActive }) => (
                            <div className={cn(
                                "p-3 rounded-full transition-all duration-300 group-hover:bg-secondary/50",
                                isActive ? "text-white bg-secondary" : "text-muted-foreground"
                            )}>
                                <Layers size={28} />
                            </div>
                        )}
                    </NavLink>

                    {/* Center: Brain (Home) */}
                    <NavLink
                        to="/"
                        className={({ isActive }) => cn(
                            "relative group flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300",
                            isActive ? "scale-115" : "scale-100"
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                {/* Glow effect behind */}
                                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl group-hover:bg-primary/40 transition-all duration-500" />

                                {/* Ring */}
                                <div className={cn(
                                    "absolute inset-0 rounded-full border border-primary/30 transition-all duration-500",
                                    isActive ? "border-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "group-hover:border-primary/50"
                                )} />

                                {/* Brain Icon */}
                                <div className="relative z-10 bg-background rounded-full p-3.5 border border-white/10">
                                    <Brain size={32} className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-white")} />
                                </div>
                            </>
                        )}
                    </NavLink>

                    {/* Right: Ask/Search */}
                    <NavLink
                        to="/ask"
                        className="w-16 h-16 flex items-center justify-center transition-all duration-300 group"
                    >
                        {({ isActive }) => (
                            <div className={cn(
                                "p-3 rounded-full transition-all duration-300 group-hover:bg-secondary/50",
                                isActive ? "text-white bg-secondary" : "text-muted-foreground"
                            )}>
                                <Search size={28} />
                            </div>
                        )}
                    </NavLink>
                </nav>
            </div>
        </div>
    )
}
