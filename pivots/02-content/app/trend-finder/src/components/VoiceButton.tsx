import { useEffect, useRef, useState } from 'react'

// Minimal types for the browser's speech recognition (Chrome, Edge, Safari). Not in TypeScript's DOM types yet.
interface SpeechResultEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

const getRecognition = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

interface Props {
  // Called while speaking (interim text) and once at the end with the final text.
  onText: (text: string) => void
  onDone: (text: string) => void
  onListeningChange?: (listening: boolean) => void
}

// Mic button for the search bar. Speech is turned into text by the browser; nothing is recorded or stored.
export function VoiceButton({ onText, onDone, onListeningChange }: Props) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const finalText = useRef('')
  const Ctor = getRecognition()

  useEffect(() => {
    onListeningChange?.(listening)
  }, [listening, onListeningChange])
  useEffect(() => () => rec.current?.stop(), [])
  // Errors show as a short pop-up, then clear.
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 4500)
    return () => clearTimeout(id)
  }, [error])

  if (!Ctor) {
    return (
      <span className="mic-btn mic-off" title="Voice search needs Chrome, Edge or Safari" aria-hidden="true">
        <MicIcon />
      </span>
    )
  }

  const start = () => {
    setError(null)
    finalText.current = ''
    const r = new Ctor()
    r.lang = 'en-AU'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText.current += res[0].transcript
        else interim += res[0].transcript
      }
      onText((finalText.current + interim).trim())
    }
    r.onerror = (e) =>
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in your browser to use voice search.'
          : e.error === 'no-speech'
            ? "Didn't catch that. Tap the mic and try again."
            : 'Voice search stopped. Try again.',
      )
    r.onend = () => {
      setListening(false)
      const text = finalText.current.trim()
      if (text) onDone(text)
    }
    rec.current = r
    setListening(true)
    r.start()
  }

  return (
    <>
      <button
        type="button"
        className={`mic-btn ${listening ? 'mic-on' : ''}`}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Search by voice'}
        title={listening ? 'Stop listening' : 'Search by voice'}
        onClick={() => (listening ? rec.current?.stop() : start())}
      >
        <MicIcon />
      </button>
      {error && (
        <span className="mic-error" role="alert">
          {error}
        </span>
      )}
    </>
  )
}

function MicIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}
