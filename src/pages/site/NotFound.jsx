import React from 'react'
import { Link } from 'react-router-dom'
import SiteLayout from './SiteLayout'

export default function NotFound({ app = false }) {
    const content = (
        <section className={app ? 'app-not-found' : 'site-page-header site-not-found'}>
            <p className="site-eyebrow">404</p>
            <h1>This page is not here.</h1>
            <p>The link may be old, or the page may have moved.</p>
            <Link className="site-button site-button-primary" to={app ? '/app' : '/'}>{app ? 'Back to App' : 'Back Home'}</Link>
        </section>
    )

    if (app) return content
    return <SiteLayout compact>{content}</SiteLayout>
}
