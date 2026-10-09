import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, useIsPresent, useReducedMotion } from 'framer-motion'
import { ArrowUp, Mic } from 'lucide-react'
import { useMemory, submit, saveDraft } from '../../state/memory'
import Feedback from '../ui/Feedback'
import { recordSentMessage } from '../../lib/review'
import { beginDictation } from '../../lib/speech'
export default function CaptureBox({ autoFocus = false }) {
  const initial = useMemory.getState().data.drafts.composer || ''
  const [input, setInput] = useState(initial), [focused, setFocused] = useState(false), [pulse, setPulse] = useState(false), [intro, setIntro] = useState(true), [sending, setSending] = useState(false), [listening, setListening] = useState(false), [starting, setStarting] = useState(false), [error, setError] = useState('')
  const textarea = useRef(null), value = useRef(initial), speech = useRef(null), mounted = useRef(true), recordingGeneration = useRef(0), pulseTimer = useRef(null), introTimer = useRef(null), beamKey = useRef(0), visibleUntil = useRef(0), taps = useRef({ count: 0, time: 0, x: 0, y: 0 }), tapStart = useRef(null)
  const reduced = useReducedMotion(), present = useIsPresent()
  useEffect(() => {
    mounted.current = true
    const generation = recordingGeneration
    const start = setTimeout(() => { setPulse(true); pulseTimer.current = setTimeout(() => setPulse(false), 800); introTimer.current = setTimeout(() => setIntro(false), 2800) }, 100)
    return () => { mounted.current = false; generation.current++; clearTimeout(start); clearTimeout(pulseTimer.current); clearTimeout(introTimer.current); void speech.current?.stop() }
  }, [])
  useEffect(() => {
    if (!present) {
      recordingGeneration.current++
      void speech.current?.stop()
      speech.current = null
      setListening(false)
    }
  }, [present])
  useLayoutEffect(() => {
    const element = textarea.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.max(146, element.scrollHeight)}px`
  }, [input])
  useEffect(() => {
    if (autoFocus && present) {
      textarea.current?.focus({ preventScroll: true })
      textarea.current?.setSelectionRange(value.current.length, value.current.length)
    }
  }, [autoFocus, present])
  function change(text) {
    value.current = text.slice(0, 20000); setInput(value.current)
    void saveDraft('composer', value.current).catch(e => { if (mounted.current) setError(e.message) })
  }
  async function stop() { const session = speech.current; speech.current = null; if (session) await session.stop(); if (mounted.current) setListening(false) }
  async function dictate() {
    if (starting) return
    if (listening) { await stop(); return }
    setStarting(true); setError(''); const generation = ++recordingGeneration.current
    const base = value.current.trimEnd()
    try {
      await stop()
      const session = await beginDictation({
        isCurrent: () => mounted.current && generation === recordingGeneration.current,
        onText: text => { if (mounted.current && generation === recordingGeneration.current) change(`${base}${base ? ' ' : ''}${text}`) },
        onEnd: () => { if (mounted.current && generation === recordingGeneration.current) setListening(false) },
        onError: message => { if (mounted.current && generation === recordingGeneration.current) { setError(message); setListening(false) } },
      })
      if (!mounted.current || generation !== recordingGeneration.current) { await session.stop(); return }
      speech.current = session; setListening(session.active()); textarea.current?.blur()
    } catch (e) { if (mounted.current) setError(e.message) } finally { if (mounted.current) setStarting(false) }
  }
  async function send() {
    if (sending || starting) return
    setSending(true); setError('')
    try {
      await stop()
      const text = value.current
      if (!text.trim()) return
      await submit(text, false)
      value.current = ''; setInput(''); textarea.current?.blur(); setFocused(false)
      recordSentMessage()
    } catch (e) { setError(e.message) } finally { setSending(false) }
  }
  function selectAll() {
    textarea.current?.focus({ preventScroll: true })
    textarea.current?.setSelectionRange(0, value.current.length)
  }
  function startTap(e) {
    const touch = e.touches.length === 1 ? e.touches[0] : null
    tapStart.current = touch ? { time: Date.now(), x: touch.clientX, y: touch.clientY } : null
    if (!touch) taps.current.count = 0
  }
  function finishTap(e) {
    const start = tapStart.current, touch = e.changedTouches[0]; tapStart.current = null
    if (!start || !touch || Date.now() - start.time > 250 || Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12) { taps.current.count = 0; return }
    const previous = taps.current, now = Date.now()
    const count = now - previous.time < 450 && Math.hypot(touch.clientX - previous.x, touch.clientY - previous.y) < 22 ? previous.count + 1 : 1
    taps.current = { count, time: now, x: touch.clientX, y: touch.clientY }
    if (count === 3) { taps.current.count = 0; requestAnimationFrame(selectAll) }
  }
  function focus() {
    clearTimeout(introTimer.current); clearTimeout(pulseTimer.current)
    if (Date.now() > visibleUntil.current) beamKey.current++
    setIntro(false); setFocused(true); setPulse(true)
    pulseTimer.current = setTimeout(() => setPulse(false), 1500)
  }
  return <><div className={`capture-wrap ${focused || listening ? 'is-focused' : ''} ${pulse ? 'is-pulsing' : ''} ${intro ? 'is-intro' : ''}`}>
    <div className="capture-glow" /><div className="capture-wisp wisp-one" /><div className="capture-wisp wisp-two" /><div className="capture-wisp wisp-three" />
    <motion.div className="capture-shell" animate={{ scale: !reduced && focused ? 1.02 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <div className="capture-border" aria-hidden="true"><div className="capture-border-base" /><div key={`blue-${beamKey.current}`} className="capture-beam beam-blue" /><div key={`light-${beamKey.current}`} className="capture-beam beam-light" /></div>
      <div className="capture-surface" onClick={e => { if (!e.target.closest('button')) textarea.current?.focus() }}><textarea ref={textarea} id="capture-thought" aria-label="Capture a thought or ask a question" placeholder="Capture anything…" value={input} readOnly={listening || starting || sending} maxLength={20000} rows={2} onClick={e => { if (e.detail === 3) { e.preventDefault(); e.stopPropagation(); selectAll() } }} onTouchStart={startTap} onTouchEnd={finishTap} onTouchCancel={() => { tapStart.current = null; taps.current.count = 0 }} onChange={e => change(e.target.value)} onFocus={focus} onBlur={() => { visibleUntil.current = Date.now() + 500; setFocused(false); setPulse(false); clearTimeout(pulseTimer.current) }} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) { e.preventDefault(); void send() } }} />
        <div className="capture-actions"><span className="capture-status" aria-live="polite">{input.length > 18000 ? `${input.length.toLocaleString()} / 20,000` : ''}</span><div className="capture-buttons"><button className={`mic-button ${listening ? 'listening' : ''}`} aria-label={listening ? 'Stop dictation' : 'Dictate a thought'} aria-pressed={listening} disabled={starting || sending} onClick={() => void dictate().catch(e => setError(e.message))}><Mic size={20} /></button><button className={`capture-send ${input.trim() ? 'ready' : ''}`} aria-label="Send" disabled={(!input.trim() && !listening) || sending || starting} onClick={send}><ArrowUp size={20} /></button></div></div>
      </div>
    </motion.div>
  </div>{error && <Feedback title="Couldn’t finish that">{error}</Feedback>}</>
}
