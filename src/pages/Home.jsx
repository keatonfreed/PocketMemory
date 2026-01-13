import React from 'react'
import CaptureBox from '@/components/features/CaptureBox'
import MemoryFeed from '@/components/features/MemoryFeed'
import PushBanner from '@/components/features/PushBanner'

export default function Home() {
    return (
        <div className="min-h-full flex flex-col relative">
            <PushBanner />

            <div className="flex-1 flex flex-col w-full justify-center min-h-[60vh] pt-12 px-6">
                {/* Header - Subtle */}
                <header className="flex justify-center mb-12 opacity-50">
                    <div className="uppercase tracking-[0.3em] text-[10px] text-muted-foreground">Pocket Memory</div>
                </header>

                {/* Main Input - Centered in this view */}
                <CaptureBox />
            </div>

            <div className="w-full px-6 pb-32">
                <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">Recent Memories</h2>
                </div>

                <MemoryFeed limit={10} />
            </div>
        </div>
    )
}
