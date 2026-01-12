import Home from '@/pages/Home'
import Search from '@/pages/Search'
import Browse from '@/pages/Browse'
import Ask from '@/pages/Ask'
import StickyNav from '@/components/layout/StickyNav'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

function App() {
    return (
        <Router>
            <div className="h-[100dvh] max-h-[100dvh] bg-background text-foreground relative font-sans antialiased overflow-hidden">
                <div className="bg-noise" />
                <main className="relative z-10 h-full w-full max-w-md mx-auto border-x border-border/50 shadow-2xl bg-background/50 backdrop-blur-3xl flex flex-col overflow-hidden">
                    <ErrorBoundary>
                        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative w-full">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/search" element={<Search />} />
                                <Route path="/browse" element={<Browse />} />
                                <Route path="/ask" element={<Ask />} />
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
