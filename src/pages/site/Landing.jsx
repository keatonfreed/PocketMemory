import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ListChecks } from 'lucide-react'
import SiteLayout from './SiteLayout'
import CaptureBox from '@/components/features/CaptureBox'
import StickyNav from '@/components/layout/StickyNav'

const previewNotes = [
    ['Launch notes', 'Ask Maya about the deck intro and save the product name options.'],
    ['Errands', 'Coffee filters, postage, blue notebook, return cable.'],
]

const previewCaptures = [
    'Remember to send Ava the camera lens notes before Thursday.',
    'Add oat milk, basil, lemons, and dish soap to the store list.',
    'Ask Jordan whether the guest room measurements are 9 by 11 or 10 by 12.',
    'Save the idea about a weekend map of quiet coffee shops.',
    'Remind me tomorrow morning to book the dentist appointment.',
    'Keep the quote from the meeting about making onboarding feel calmer.',
    'Add passport renewal, laptop charger, and rain shell to the travel list.',
    'Find the article about sleep routines and send it to Nico later.',
]

export default function Landing() {
    const [previewIndex, setPreviewIndex] = useState(0)

    useEffect(() => {
        const timer = window.setInterval(() => {
            setPreviewIndex(index => (index + 1) % previewCaptures.length)
        }, 3600)

        return () => window.clearInterval(timer)
    }, [])

    return (
        <SiteLayout>
            <section className="landing-hero">
                <div className="hero-device" aria-hidden="true">
                    <div className="hero-app-surface">
                        <header className="hero-app-title">Pocket Memory</header>
                        <div className="hero-capture-wrap">
                            <div className="hero-capture-fader" key={previewCaptures[previewIndex]}>
                                <CaptureBox preview previewText={previewCaptures[previewIndex]} />
                            </div>
                        </div>
                        <div className="hero-recent">
                            <div className="hero-recent-head">Recent Documents</div>
                            <div className="hero-feed">
                                {previewNotes.map(([title, text], index) => {
                                    const Icon = index === 1 ? ListChecks : FileText
                                    return (
                                        <div className="hero-note" key={title}>
                                            <div>
                                                <Icon size={15} />
                                                <strong>{title}</strong>
                                            </div>
                                            <p>{text}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <StickyNav preview />
                    </div>
                </div>

                <div className="hero-copy">
                    <p className="site-eyebrow">Capture the thought. Find it later.</p>
                    <h1>Your memory, before it slips.</h1>
                    <p>
                        Save notes, lists, reminders, and half-formed ideas in one place with <span style={{ fontWeight: "bold", color: "black", display: "inline-block" }}>AI</span>.                        Ask for them later in plain language.
                    </p>
                    <div className="hero-actions">
                        <Link className="site-button site-button-primary" to="/install">Install Free</Link>
                    </div>
                </div>
            </section>

            <section className="site-feature-band" aria-label="Highlights">
                <article>
                    <span>Capture</span>
                    <h2>Say it before it slips.</h2>
                    <p>Turn quick thoughts into structured notes and lists without choosing a folder first.</p>
                </article>
                <article>
                    <span>Browse</span>
                    <h2>Your notes stay findable.</h2>
                    <p>Recent documents, saved lists, and pinned memories are close when the day gets busy.</p>
                </article>
                <article>
                    <span>Ask</span>
                    <h2>Search in plain language.</h2>
                    <p>Ask for what you remember vaguely and let Pocket Memory pull the right thread forward.</p>
                </article>
            </section>

            <section className="site-closing">
                <p className="site-eyebrow">Made to feel like an app</p>
                <h2>Install it, open it, and keep moving.</h2>
                <p>Pocket Memory works as a website today and as a home-screen PWA when you want it closer.</p>
                <Link className="site-button site-button-primary" to="/install">Install Free</Link>
            </section>
        </SiteLayout>
    )
}
