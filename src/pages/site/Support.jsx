import React from 'react'
import { Link } from 'react-router-dom'
import { Mail, ShieldCheck, Smartphone } from 'lucide-react'
import SiteLayout from './SiteLayout'

export default function Support() {
    return (
        <SiteLayout compact>
            <section className="site-page-header">
                <p className="site-eyebrow">Support</p>
                <h1>Help for Pocket Memory.</h1>
                <p>Quick answers for installing, using, and troubleshooting the app.</p>
            </section>

            <section className="site-info-list">
                <article>
                    <Smartphone size={22} />
                    <div>
                        <h2>Install on your phone</h2>
                        <p>Use the guided install page for iPhone and home-screen setup.</p>
                        <Link to="/install">Open install guide</Link>
                    </div>
                </article>
                <article>
                    <ShieldCheck size={22} />
                    <div>
                        <h2>Notifications</h2>
                        <p>If reminders are quiet, reopen the app at `/app`, allow notifications, and check browser notification settings.</p>
                    </div>
                </article>
                <article>
                    <Mail size={22} />
                    <div>
                        <h2>Contact</h2>
                        <p>For help, bug reports, or account questions, email support@pocketmemory.app.</p>
                    </div>
                </article>
            </section>
        </SiteLayout>
    )
}
