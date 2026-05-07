import React from 'react'
import SiteLayout from './SiteLayout'

export default function Privacy() {
    return (
        <SiteLayout compact>
            <section className="site-page-header">
                <p className="site-eyebrow">Privacy</p>
                <h1>Privacy Policy</h1>
                <p>Last updated April 27, 2026.</p>
            </section>

            <section className="site-policy">
                <h2>What Pocket Memory stores</h2>
                <p>Pocket Memory stores the notes, lists, reminders, and document details you add to the app so it can show them back to you and help you search them.</p>

                <h2>How the app uses data</h2>
                <p>Your content is used to provide core app features, including capture, browsing, reminders, and question answering. Push subscriptions are used only to deliver notifications you enable.</p>

                <h2>What stays on your device</h2>
                <p>The app may keep local browser data such as a user key, cached app files, and saved interface state so the PWA can open quickly and remember your session.</p>

                <h2>Third-party services</h2>
                <p>Pocket Memory may use hosting, database, push notification, and AI services to run the app. These services process data only as needed to provide the app experience.</p>

                <h2>Your choices</h2>
                <p>You can remove browser data, unsubscribe from notifications, or contact support@pocketmemory.app for help with privacy questions.</p>
            </section>
        </SiteLayout>
    )
}
