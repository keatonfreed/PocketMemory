import { useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
function Page({ children, className, duration, scrollKey, positions, resetScroll }) {
  const present = useIsPresent(), reduced = useReducedMotion(), pane = useRef(null)
  useLayoutEffect(() => {
    if (!present || !scrollKey) return
    if (resetScroll) positions.current.set(scrollKey, 0)
    pane.current.scrollTop = positions.current.get(scrollKey) || 0
  }, [scrollKey, positions, resetScroll, present])
  useLayoutEffect(() => {
    if (!present && scrollKey) positions.current.set(scrollKey, Math.max(0, pane.current.scrollTop))
  }, [present, scrollKey, positions])
  return <motion.main ref={pane} onScroll={e => { if (present && scrollKey) positions.current.set(scrollKey, Math.max(0, e.currentTarget.scrollTop)) }} className={className} tabIndex={-1} inert={present ? undefined : ''} aria-hidden={!present || undefined}
    initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduced ? 0 : duration, ease: [.25, .1, .25, 1] }}
    style={{ pointerEvents: present ? 'auto' : 'none', zIndex: present ? 1 : 0 }}>
    {children}
  </motion.main>
}
// Bottom tabs retain independent positions; other destinations start at the top.
export default function Screen({ pageKey, children, className = 'app-scroll', duration = .24, resetScroll = false }) {
  const positions = useRef(new Map())
  const scrollKey = ['home', 'memory', 'reminders'].includes(pageKey) ? pageKey : null
  return <div className="screen-stack"><AnimatePresence initial={false}>
    <Page key={pageKey} className={className} duration={duration} scrollKey={scrollKey} positions={positions} resetScroll={resetScroll}>{children}</Page>
  </AnimatePresence></div>
}
