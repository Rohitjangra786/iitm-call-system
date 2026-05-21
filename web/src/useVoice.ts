import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API types are not always in lib.dom.d.ts; declare loosely.
type AnySR = any

function getSR(): AnySR | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechSupported(): { listen: boolean; speak: boolean } {
  return {
    listen: getSR() !== null,
    speak: typeof window !== 'undefined' && 'speechSynthesis' in window,
  }
}

/** Pick an Indian-English voice if installed, otherwise any English voice. */
export function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const all = window.speechSynthesis.getVoices()
  if (!all.length) return null
  return (
    all.find(v => v.lang === 'en-IN') ||
    all.find(v => v.lang.startsWith('en-IN')) ||
    all.find(v => /india|aditi|raveena|priya|kalpana/i.test(v.name)) ||
    all.find(v => v.lang.startsWith('en-GB')) ||
    all.find(v => v.lang.startsWith('en')) ||
    all[0]
  )
}

export function speak(text: string, voice?: SpeechSynthesisVoice | null): Promise<void> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.lang = (voice?.lang) || 'en-IN'
    u.rate = 1.0
    u.pitch = 1.0
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export interface UseListenOpts {
  onResult: (text: string) => void
  onError?: (err: string) => void
  lang?: string
}

/** Single-shot listen: starts recognition, fires onResult with the final transcript. */
export function useListen({ onResult, onError, lang = 'en-IN' }: UseListenOpts) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<AnySR | null>(null)
  const finalRef = useRef('')

  const start = useCallback(() => {
    const SR = getSR()
    if (!SR) { onError?.('Speech recognition not supported on this browser'); return }
    stopSpeaking() // never listen while TTS is still talking
    const r = new SR()
    r.lang = lang
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    finalRef.current = ''
    setInterim('')
    r.onresult = (e: any) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalRef.current += res[0].transcript
        else interimText += res[0].transcript
      }
      setInterim(interimText)
    }
    r.onerror = (e: any) => {
      setListening(false)
      onError?.(e.error || 'recognition error')
    }
    r.onend = () => {
      setListening(false)
      const text = finalRef.current.trim()
      if (text) onResult(text)
    }
    try {
      r.start()
      recRef.current = r
      setListening(true)
    } catch (e: any) {
      onError?.(e?.message || String(e))
    }
  }, [lang, onResult, onError])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* ignore */ }
    setListening(false)
  }, [])

  useEffect(() => () => { try { recRef.current?.abort() } catch { /* ignore */ } }, [])

  return { start, stop, listening, interim }
}
