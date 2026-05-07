import React from 'react'
import { Link } from 'react-router-dom'
import { Brain } from 'lucide-react'

export default function SiteLayout({ children, compact = false }) {
    return (
        <div className="site-shell">
            <header className="site-header">
                <Link className="site-brand" to="/" aria-label="Pocket Memory home">
                    <span className="site-brand-mark">
                        <Brain size={21} />
                    </span>
                    <span>Pocket Memory</span>
                </Link>
                <nav className="site-nav" aria-label="Primary">
                    <Link to="/support">Support</Link>
                    <Link to="/privacy">Privacy</Link>
                    <Link className="site-nav-cta" to="/install">Install</Link>
                </nav>
            </header>
            <main className={compact ? 'site-main site-main-compact' : 'site-main'}>
                {children}
            </main>
            <footer className="site-footer">
                <span>&copy; 2026 Pocket Memory</span>
                <div>
                    <Link to="/support">Support</Link>
                    <Link to="/privacy">Privacy</Link>
                </div>
            </footer>
        </div>
    )
}
