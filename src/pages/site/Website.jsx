import { Brain, ArrowUpRight, Mic, Layers, Search, Mail } from 'lucide-react'
import Policy from '../../components/ui/Policy'
import Navigation from '../../components/app/Navigation'
import { appStoreUrl } from '../../../shared/app-store'
const store = appStoreUrl(import.meta.env.VITE_APP_STORE_URL)
function StoreLink() { return store ? <a className="site-download" href={store} target="_blank" rel="noopener noreferrer">Download on the App Store <ArrowUpRight size={19} /></a> : <span className="site-availability">Coming to the App Store</span> }
export default function Website() {
  const page = location.pathname.replace(/\/$/, '')
  const policy = page === '/privacy' || page === '/terms'
  return <div className="site-shell"><header className="site-header"><a className="site-brand" href="/"><Brain size={25} /> Pocket Memory</a><nav><a href="/support">Support</a><StoreLink /></nav></header><main className="site-main">{policy ? <div className="site-document"><Policy terms={page === '/terms'} /></div> : page === '/support' ? <section className="site-document support-page"><Mail size={34} /><h1>Here to help.</h1><p>Questions about Pocket Memory or your account?</p><a className="site-download" href="mailto:keaton@mfreed.com">Contact support <ArrowUpRight size={18} /></a><div className="support-links"><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a></div></section> : <>
    <section className="landing-hero"><div className="hero-copy"><span className="site-eyebrow">Pocket Memory for iPhone</span><h1>Your memory,<br />before it slips.</h1><p>Thoughts, plans, and everything in between.<br />Say it now. Find it when you need it.</p><StoreLink /></div><div className="hero-device" aria-hidden="true"><div className="device-island" /><div className="device-wordmark"><Brain size={18} /> Pocket Memory</div><h2>What’s on<br />your mind?</h2><div className="preview-capture"><div className="preview-beam" /><div className="preview-surface"><span>Capture anything…</span><div><Mic size={18} /><span className="preview-send">↑</span></div></div></div><div className="device-mark"><Brain size={48} strokeWidth={.8} /></div><Navigation preview /></div></section>
    <section className="site-features"><article><Mic size={24} /><h2>Say it.</h2><p>Capture a thought while it’s still fresh.</p></article><article><Layers size={24} /><h2>Keep it.</h2><p>Your notes, lists, and reminders together.</p></article><article><Search size={24} /><h2>Find it.</h2><p>Ask in your own words.</p></article></section>
  </>}</main><footer className="site-footer"><a className="site-brand" href="/"><Brain size={19} /> Pocket Memory</a><div><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></div></footer></div>
}
