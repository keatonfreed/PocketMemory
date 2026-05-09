import Home from '@/pages/Home'
import Browse from '@/pages/Browse'
import Ask from '@/pages/Ask'
import OpenDocument from '@/pages/OpenDocument'
import Landing from '@/pages/site/Landing'
import Install from '@/pages/site/Install'
import Support from '@/pages/site/Support'
import Privacy from '@/pages/site/Privacy'
import NotFound from '@/pages/site/NotFound'
import StickyNav from '@/components/layout/StickyNav'
import { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import CaptureStatusPills from '@/components/features/CaptureStatusPills'
import DevAiDebugPanel from '@/components/features/DevAiDebugPanel'

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

function FloatingCaptureStatus() {
    const { pathname } = useLocation()
    const isHome = pathname === '/app' || pathname === '/app/'

    if (isHome) return null
    return <CaptureStatusPills floating />
}


if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
}

function MemoryApp() {
    const scrollRef = useRef(null)

    useEffect(() => {
        document.body.classList.add('app-scroll-locked')
        return () => document.body.classList.remove('app-scroll-locked')
    }, [])

    return (
        <div className="app-frame h-dvh max-h-dvh bg-background text-foreground relative font-sans antialiased overflow-hidden">
            <div className="bg-noise" />
            <TopScrollOnNavigate scrollRef={scrollRef} />
            <DevAiDebugPanel />
            <main className="relative z-10 h-full min-h-0 w-full max-w-[500px] mx-auto shadow-2xl bg-background/50 backdrop-blur-3xl flex flex-col overflow-hidden">
                <ErrorBoundary>
                    <FloatingCaptureStatus />
                    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar scroll-smooth relative w-full">
                        <Routes>
                            <Route index element={<Home />} />
                            <Route path="browse" element={<Browse />} />
                            <Route path="ask" element={<Ask />} />
                            <Route path="document/:docId" element={<OpenDocument />} />
                            <Route path="*" element={<NotFound app />} />
                        </Routes>
                    </div>
                    <StickyNav />
                </ErrorBoundary>
            </main>
        </div>
    )
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/install" element={<Install />} />
                <Route path="/support" element={<Support />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/app/*" element={<MemoryApp />} />

                <Route path="/browse" element={<Navigate to="/app/browse" replace />} />
                <Route path="/ask" element={<Navigate to="/app/ask" replace />} />
                <Route path="/document/:docId" element={<NavigateToAppDocument />} />

                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    )
}

function NavigateToAppDocument() {
    const { pathname } = useLocation()
    return <Navigate to={`/app${pathname}`} replace />
}

export default App
