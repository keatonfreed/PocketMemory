import Home from '@/pages/Home'
import Browse from '@/pages/Browse'
import Ask from '@/pages/Ask'
import OpenDocument from '@/pages/OpenDocument'
import StickyNav from '@/components/layout/StickyNav'
import { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

function TopScrollOnNavigate({ scrollRef }) {
    const { pathname } = useLocation()

    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: 0,
            behavior: 'instant'
        })
    }, [pathname])

    return null
}


if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
}

function App() {
    const scrollRef = useRef(null)
    return (
        <Router>
            <div className="h-dvh max-h-dvh bg-background text-foreground relative font-sans antialiased overflow-hidden">
                <div className="bg-noise" />
                <TopScrollOnNavigate scrollRef={scrollRef} />
                <main className="relative z-10 h-full w-full max-w-md mx-auto border-x border-border/50 shadow-2xl bg-background/50 backdrop-blur-3xl flex flex-col overflow-hidden">
                    <ErrorBoundary>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative w-full">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/browse" element={<Browse />} />
                                <Route path="/ask" element={<Ask />} />
                                <Route path="/document/:docId" element={<OpenDocument />} />
                            </Routes>
                        </div>
                        <StickyNav />
                    </ErrorBoundary>
                </main>
            </div>
        </Router>
    )
}

export default App
