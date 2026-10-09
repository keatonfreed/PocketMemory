import { useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls, useIsPresent, useReducedMotion, useMotionValue, useSpring } from 'framer-motion'
import { Brain, ArrowRight, ArrowLeft, Bell, ListTodo } from 'lucide-react'
import { signIn, setConsent } from '../../state/memory'
import AsyncButton from '../ui/AsyncButton'
import { softHaptic } from '../../lib/haptics'
const steps = ['welcome', 'benefits', 'signin']
function OnboardingPanel({ step, direction, children }) {
  const present = useIsPresent(), reduced = useReducedMotion()
  return <motion.section className={`onboarding-panel ${step}`} inert={present ? undefined : ''} aria-hidden={!present || undefined}
    style={{ pointerEvents: present ? 'auto' : 'none' }} custom={direction}
    variants={{ enter: d => ({ opacity: 0, x: reduced ? 0 : d * 64 }), center: { opacity: 1, x: 0 }, leave: d => ({ opacity: 0, x: reduced ? 0 : d * -56, transition: { opacity: { duration: reduced ? 0 : .32, ease: 'easeOut' }, x: { duration: reduced ? 0 : 1.1, ease: [.22, 1, .36, 1] } } }) }}
    initial="enter" animate="center" exit="leave" transition={{ opacity: { duration: reduced ? 0 : .9, ease: 'easeInOut' }, x: { duration: reduced ? 0 : 1.1, ease: [.22, 1, .36, 1] } }}>{children}</motion.section>
}
function WelcomeBrain() {
  const reduced = useReducedMotion(), origin = useRef({ x: 0, y: 0 })
  const targetX = useMotionValue(0), targetY = useMotionValue(0)
  const x = useSpring(targetX, { stiffness: 300, damping: 30, mass: .45 }), y = useSpring(targetY, { stiffness: 300, damping: 30, mass: .45 })
  function release() { targetX.set(0); targetY.set(0) }
  return <motion.div className="welcome-brain-drag" data-floating-object data-no-keyboard-dismiss
    onPanStart={() => {
      origin.current = { x: 12 * Math.atanh(Math.max(-.99, Math.min(.99, x.get() / 12))), y: 10 * Math.atanh(Math.max(-.99, Math.min(.99, y.get() / 10))) }
      softHaptic()
    }} onPan={(_event, info) => {
      targetX.set(12 * Math.tanh((origin.current.x + info.offset.x) / 12))
      targetY.set(10 * Math.tanh((origin.current.y + info.offset.y) / 10))
    }} onPanEnd={release} onPointerCancel={release} style={{ touchAction: 'none', x: reduced ? targetX : x, y: reduced ? targetY : y }}>
    <motion.div className="brain-medallion" animate={reduced ? {} : { y: [-7, 0, 7, 0, -7], x: [0, 9, 0, -9, 0] }}
      transition={{ duration: 22, repeat: Infinity, x: { duration: 22, repeat: Infinity, ease: [[.33, .52, .67, 1], [.33, 0, .67, .48], [.33, .52, .67, 1], [.33, 0, .67, .48]] }, y: { duration: 22, repeat: Infinity, ease: [[.33, 0, .67, .48], [.33, .52, .67, 1], [.33, 0, .67, .48], [.33, .52, .67, 1]] } }}><Brain size={64} strokeWidth={1.2} /></motion.div>
  </motion.div>
}
function FloatingObject({ className, children }) {
  const [held, setHeld] = useState(false)
  return <motion.div className={className} data-floating-object data-no-keyboard-dismiss drag dragSnapToOrigin dragMomentum={false}
    dragTransition={{ bounceStiffness: 130, bounceDamping: 20 }} style={{ touchAction: 'none', animationPlayState: held ? 'paused' : 'running' }}
    onPointerDown={() => setHeld(true)} onPointerUp={() => setHeld(false)} onPointerCancel={() => setHeld(false)}
    onDragStart={() => softHaptic()} onDragEnd={() => { setHeld(false); softHaptic() }}>{children}</motion.div>
}
function MessageBackdrop() {
  return <div className="onboarding-messages" aria-hidden="true">{['Remember this for later', 'Saved to your memories', 'Remind me tomorrow', 'A little less to remember'].map((text, i) => <FloatingObject className={`demo-message demo-${i}`} key={text}>{text}</FloatingObject>)}{[0, 1, 2, 3, 4].map(i => <FloatingObject key={i} className={`backdrop-brain backdrop-brain-${i}`}><Brain size={24 + i * 7} strokeWidth={1.2} /></FloatingObject>)}</div>
}
export default function Onboarding({ onPolicy, consentOnly = false }) {
  const [step, setStep] = useState(consentOnly ? 'consent' : 'welcome'), [agreed, setAgreed] = useState(false), [direction, setDirection] = useState(1)
  const reduced = useReducedMotion(), agreementMotion = useAnimationControls(), checkbox = useRef(null), swipe = useRef(null)
  const [needsAgreement, setNeedsAgreement] = useState(false)
  function confirmAgreement() {
    if (agreed) return true
    setNeedsAgreement(true)
    checkbox.current?.focus({ preventScroll: true })
    if (!reduced) void agreementMotion.start({ x: [0, -3, 3, -2, 0], transition: { duration: .3 } })
    return false
  }
  function navigate(next) { setDirection(steps.indexOf(next) < steps.indexOf(step) ? -1 : 1); setStep(next) }
  return <main className="onboarding"><div className="onboarding-top">{!consentOnly && step !== 'welcome' && <button className="text-button onboarding-back" aria-label="Back" onClick={() => navigate(steps[steps.indexOf(step) - 1])}><ArrowLeft size={18} /> Back</button>}</div>
    <div className="onboarding-stage"><AnimatePresence custom={direction} initial={false}><OnboardingPanel key={step} step={step} direction={direction}>
      {(step === 'welcome' || step === 'benefits') && <div className="welcome-atmosphere" aria-hidden="true" />}
      <div className="onboarding-hero" onTouchStart={e => { const touch = e.touches[0]; swipe.current = e.touches.length === 1 && !e.target.closest('[data-floating-object]') ? { x: touch.clientX, y: touch.clientY } : null }} onTouchCancel={() => { swipe.current = null }} onTouchEnd={e => {
        const start = swipe.current, touch = e.changedTouches[0]; swipe.current = null
        if (!start || !touch || consentOnly || Math.abs(touch.clientY - start.y) > 40) return
        const distance = touch.clientX - start.x, index = steps.indexOf(step)
        const next = distance < -65 ? steps[index + 1] : distance > 65 ? steps[index - 1] : null
        if (next) { softHaptic(); navigate(next) }
      }}>{step === 'welcome' ? <><div className="onboarding-art" aria-hidden="true"><div className="brain-aura" /><WelcomeBrain /></div></> : step === 'benefits' ? <><div className="benefit-examples" aria-hidden="true"><div><Brain size={19} /><span>“Remember how I like my coffee”</span></div><div><Bell size={19} /><span>“Remind me to call Mom tomorrow”</span></div><div><ListTodo size={19} /><span>“Make a packing list for my trip”</span></div></div></> : <MessageBackdrop />}
      <div className="onboarding-copy"><h1>{step === 'welcome' ? 'Pocket Memory' : step === 'benefits' ? 'A little less\nto remember.' : step === 'signin' ? 'Make it yours.' : 'Ready when you are.'}</h1><p>{step === 'welcome' ? 'Your personal AI for keeping track of every thought.' : step === 'benefits' ? 'Save details, set reminders, and turn your thoughts into useful notes and lists.' : step === 'signin' ? <>One account. <span className="onboarding-free">Free</span> to use.</> : 'A little help remembering and following through.'}</p></div></div>
      <div className={`onboarding-actions aligned-actions ${step === 'welcome' || step === 'benefits' ? 'intro-actions' : ''}`}>{step === 'welcome' || step === 'benefits' ? <><div className="agreement-slot" aria-hidden="true" /><button className="primary-button wide onboarding-cta" onClick={() => navigate(step === 'welcome' ? 'benefits' : 'signin')}>{step === 'welcome' ? 'Get started' : 'Continue'} <ArrowRight size={19} /></button><div className="legal-slot" aria-hidden="true" /></> : step === 'signin' ? <>
        <div className="agreement-slot"><motion.label animate={agreementMotion} className={`onboarding-agreement ${needsAgreement && !agreed ? 'needs-agreement' : ''}`}><input ref={checkbox} type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setNeedsAgreement(false) }} /><span>I allow OpenAI and TypeSafe to process my entries and memories for AI assistance.</span></motion.label></div>
        <AsyncButton beforeAction={confirmAgreement} className="apple-signin onboarding-cta" busyLabel="Signing in…" errorTitle="Couldn’t sign in" onClick={() => signIn({ allowAI: true })}><span className="apple-glyph" aria-hidden="true"></span> Sign in with Apple</AsyncButton>
        <p className="legal-note legal-slot">By signing in, you agree to our <button onClick={() => onPolicy('terms')}>Terms</button> and <button onClick={() => onPolicy('privacy')}>Privacy Policy</button>.</p>
      </> : <><p className="consent-note agreement-slot">Allow OpenAI and TypeSafe to process your entries and relevant memories to answer and organize them. <button onClick={() => onPolicy('privacy')}>Privacy details</button></p><AsyncButton className="primary-button wide onboarding-cta" busyLabel="Getting ready…" errorTitle="Couldn’t finish setup" onClick={() => setConsent(true)}>Agree and continue <ArrowRight size={19} /></AsyncButton><div className="legal-slot" /></>}</div>
    </OnboardingPanel></AnimatePresence></div>
  </main>
}
