import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Brain } from 'lucide-react'
const labels = ['Getting ready…', 'Making room for your thoughts…', 'Setting things up…']
export default function GettingReady() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * labels.length)), reduced = useReducedMotion()
  useEffect(() => {
    const timer = setInterval(() => setIndex(current => (current + 1) % labels.length), 3200)
    return () => clearInterval(timer)
  }, [])
  return <div className="launch launch-preparing"><Brain size={42} /><div className="getting-ready-label" role="status" aria-live="polite"><AnimatePresence mode="wait" initial={false}><motion.span key={index} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -4 }} transition={{ duration: reduced ? 0 : .3 }}>{labels[index]}</motion.span></AnimatePresence></div></div>
}
