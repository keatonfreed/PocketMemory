import { Brain, BookOpen, Bell } from 'lucide-react'
const tabs = [{ id: 'memory', title: 'Memory', icon: BookOpen }, { id: 'home', title: 'Home', icon: Brain }, { id: 'reminders', title: 'Reminders', icon: Bell }]
export default function Navigation({ tab = 'home', onChange, preview = false }) {
  return <div className={`nav-dock ${preview ? 'nav-preview' : ''}`}><nav aria-label="Main navigation">{tabs.map(({ id, title, icon: Icon }) => <button key={id} aria-label={title} title={title} aria-current={tab === id ? 'page' : undefined} tabIndex={preview ? -1 : undefined} onClick={() => onChange?.(id)} className={`${id === 'home' ? 'nav-brain' : 'nav-side'} ${tab === id ? 'active' : ''}`}>
    {id === 'home' && <><span className="nav-glow" /><span className="nav-ring" /></>}<span className="nav-icon"><Icon size={id === 'home' ? 32 : 28} strokeWidth={1.7} /></span>
  </button>)}</nav></div>
}
