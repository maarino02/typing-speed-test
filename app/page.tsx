'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RotateCcw, Timer, Zap } from 'lucide-react'

const passages = [
  'The best way to predict the future is to create it. Small steps taken consistently can turn a quiet idea into meaningful progress.',
  'A clear mind notices the details: the rhythm of rain, the warmth of morning light, and the gentle momentum of work done well.',
  'Good tools should disappear into the background, leaving you with focus, confidence, and just enough feedback to keep moving.',
  'Every expert was once a beginner who chose to practice one more time. Patience makes room for precision, and precision becomes speed.',
  'Stories connect distant places and unfamiliar people. They remind us that curiosity is a practical form of courage.',
]

type TestState = 'ready' | 'running' | 'finished'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

function pickPassage(previous?: string) {
  const options = passages.filter((passage) => passage !== previous)
  return options[Math.floor(Math.random() * options.length)] ?? passages[0]
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remaining}`
}

export default function Page() {
  const [passage, setPassage] = useState(passages[0])
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<TestState>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [finishedStats, setFinishedStats] = useState({ wpm: 0, accuracy: 0, elapsed: 0 })
  const typedRef = useRef('')
  const totalKeypressesRef = useRef(0)
  const correctKeypressesRef = useRef(0)

  const metrics = useMemo(() => {
    const minutes = elapsed / 60
    const wpm = minutes > 0 ? (typed.length / 5) / minutes : 0
    const accuracy = totalKeypressesRef.current > 0 ? (correctKeypressesRef.current / totalKeypressesRef.current) * 100 : 100
    return { wpm, accuracy }
  }, [elapsed, typed])

  const finishTest = useCallback((finalElapsed: number) => {
    const finalWpm = finalElapsed > 0 ? (passage.length / 5) / (finalElapsed / 60) : 0
    const finalAccuracy = totalKeypressesRef.current > 0 ? (correctKeypressesRef.current / totalKeypressesRef.current) * 100 : 100
    setFinishedStats({ wpm: finalWpm, accuracy: finalAccuracy, elapsed: finalElapsed })
    setElapsed(finalElapsed)
    setState('finished')
    void supabase?.from('typing_results').insert({
      passage_length: passage.length,
      wpm: Number(finalWpm.toFixed(2)),
      accuracy: Number(finalAccuracy.toFixed(2)),
      elapsed_seconds: Number(finalElapsed.toFixed(2)),
    })
  }, [passage])

  const resetTest = useCallback(() => {
    setPassage((current) => pickPassage(current))
    setTyped('')
    typedRef.current = ''
    totalKeypressesRef.current = 0
    correctKeypressesRef.current = 0
    setElapsed(0)
    setStartedAt(null)
    setState('ready')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (state === 'finished' || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Tab' || event.key === 'Escape') return
      if (event.key === 'Backspace') {
        event.preventDefault()
        const nextTyped = typedRef.current.slice(0, -1)
        typedRef.current = nextTyped
        setTyped(nextTyped)
        return
      }
      if (event.key.length !== 1 || typedRef.current.length >= passage.length) return
      event.preventDefault()
      if (state === 'ready') {
        const now = Date.now()
        setStartedAt(now)
        setState('running')
      }
      totalKeypressesRef.current += 1
      if (event.key === passage[typedRef.current.length]) correctKeypressesRef.current += 1
      const nextTyped = typedRef.current + event.key
      typedRef.current = nextTyped
      setTyped(nextTyped)
      if (nextTyped.length === passage.length) {
        const finalElapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0
        finishTest(finalElapsed)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finishTest, passage, startedAt, state])

  useEffect(() => {
    if (state !== 'running' || !startedAt) return
    const interval = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100)
    return () => window.clearInterval(interval)
  }, [startedAt, state])

  const currentStats = state === 'finished' ? finishedStats : { ...metrics, elapsed }

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Zap className="size-4" /></div>
            <div><p className="font-mono text-sm font-semibold tracking-tight">keystroke</p><p className="text-xs text-muted-foreground">typing speed test</p></div>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{state === 'finished' ? 'completed' : state === 'running' ? 'in progress' : 'ready when you are'}</p>
        </header>

        <section className="flex flex-1 flex-col justify-center gap-10 py-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div><p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-primary">speed lab / 001</p><h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Find your flow.</h1></div>
            <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground"><Timer className="size-4" /><span>{formatTime(currentStats.elapsed)}</span><span className="text-border">/</span><span>{state === 'finished' ? 'final time' : 'elapsed'}</span></div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/10 sm:p-10">
            <div className="mb-7 flex items-center justify-between gap-4"><p className="font-mono text-xs text-muted-foreground">Type the passage below</p><p className="font-mono text-xs text-muted-foreground">{typed.length} / {passage.length}</p></div>
            <p aria-label="Typing passage" className="font-mono text-xl leading-[1.9] tracking-wide sm:text-2xl">
              {Array.from(passage).map((character, index) => {
                const typedCharacter = typed[index]
                const className = typedCharacter === undefined ? 'text-muted-foreground/45' : typedCharacter === character ? 'text-primary' : 'text-destructive underline decoration-2 underline-offset-4'
                return <span className={`${className} ${index === typed.length ? 'border-l-2 border-primary pl-0.5' : ''}`} key={`${character}-${index}`}>{character}</span>
              })}
              {typed.length === passage.length && <span className="border-l-2 border-primary" />}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="font-mono text-xs text-muted-foreground">{state === 'ready' ? 'Start typing to begin' : state === 'running' ? 'Keep going — accuracy matters' : 'Nice work. Review your result.'}</p><div className="flex gap-5 font-mono text-xs"><span><b className="text-foreground">{Math.round(currentStats.wpm)}</b> wpm</span><span><b className="text-foreground">{Math.round(currentStats.accuracy)}%</b> accuracy</span></div></div>
          </div>

          {state === 'finished' && <section aria-label="Test results" className="grid grid-cols-3 gap-3 sm:gap-5"><div className="rounded-xl border border-border bg-card p-4 sm:p-5"><p className="font-mono text-xs text-muted-foreground">WPM</p><p className="mt-2 text-3xl font-semibold tracking-tight">{Math.round(finishedStats.wpm)}</p></div><div className="rounded-xl border border-border bg-card p-4 sm:p-5"><p className="font-mono text-xs text-muted-foreground">Accuracy</p><p className="mt-2 text-3xl font-semibold tracking-tight">{Math.round(finishedStats.accuracy)}%</p></div><div className="rounded-xl border border-border bg-card p-4 sm:p-5"><p className="font-mono text-xs text-muted-foreground">Time</p><p className="mt-2 text-3xl font-semibold tracking-tight">{formatTime(finishedStats.elapsed)}</p></div></section>}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"><p className="font-mono text-xs text-muted-foreground">Backspace supported · direct keyboard input</p>{state === 'finished' && <button type="button" onClick={resetTest} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-mono text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-85"><RotateCcw className="size-3.5" />Try again</button>}</footer>
      </div>
    </main>
  )
}
