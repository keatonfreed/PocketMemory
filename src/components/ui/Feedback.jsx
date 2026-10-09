import { AlertCircle, Loader2 } from 'lucide-react'
export default function Feedback({ title = 'Something went wrong', children }) {
  return <div className="feedback" role="alert"><AlertCircle size={20} /><div><strong>{title}</strong><p>{children}</p></div></div>
}
export function Loading({ label = 'Loading' }) { return <span className="loading-state" role="status"><Loader2 className="spin" size={20} /><span>{label}</span></span> }
