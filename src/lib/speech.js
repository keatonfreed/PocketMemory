import { SpeechRecognition } from '@capgo/capacitor-speech-recognition'
import { App } from '@capacitor/app'
export async function beginDictation({ onText, onEnd, onError, isCurrent = () => true }, plugin = SpeechRecognition, lifecycle = App) {
  if (!(await plugin.available()).available) throw new Error('Dictation isn’t available on this device. You can still type your thought.')
  const permission = await plugin.requestPermissions()
  if (permission.speechRecognition !== 'granted') throw new Error('Allow Microphone and Speech Recognition for Pocket Memory in iPhone Settings to use dictation.')
  if (!isCurrent()) throw new Error('Dictation cancelled.')
  let active = true, closed = false, ending
  const handles = []
  const deliver = event => { const text = event.accumulatedText || event.text || event.matches?.[0]; if (!closed && text) onText(text) }
  async function cleanup() {
    if (closed) return
    closed = true; active = false
    await Promise.all(handles.splice(0).map(handle => handle.remove()))
    onEnd()
  }
  function stop() {
    return ending ||= Promise.resolve().then(async () => {
      try {
        if (active) await plugin.stop()
        const cached = await plugin.getLastPartialResult()
        deliver(cached)
      } finally { await cleanup() }
    })
  }
  try {
    handles.push(await plugin.addListener('partialResults', deliver))
    handles.push(await plugin.addListener('listeningState', event => {
      if (event.state === 'stopped' || event.status === 'stopped') { active = false; void stop().catch(() => onError('Dictation stopped. Your transcribed words are still here.')) }
    }))
    handles.push(await plugin.addListener('error', () => { onError('Dictation was interrupted. Check your connection or microphone access, then try again.'); void stop().catch(() => {}) }))
    handles.push(await lifecycle.addListener('appStateChange', ({ isActive }) => { if (!isActive) void stop().catch(() => {}) }))
    if (!isCurrent()) { await cleanup(); throw new Error('Dictation cancelled.') }
    await plugin.start({ language: navigator.language || 'en-US', partialResults: true, maxResults: 1, addPunctuation: true })
    return { stop, active: () => active }
  } catch (error) {
    await plugin.stop().catch(() => {})
    await cleanup()
    throw new Error(/permission|denied/i.test(error.message || '') ? 'Allow Microphone and Speech Recognition in iPhone Settings to use dictation.' : 'Couldn’t start dictation. Check microphone access and try again.')
  }
}
