'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X, LoaderCircle, Sparkles } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }
const PROMPTS = [
  'What happens when a 2 m meteorite hits the Moon at 20 km/s?',
  'Why do meteors burn up on Earth but not the Moon?',
  'How do impact craters form?',
]

export default function MeteorChat({ world, onClose }: { world: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, loading])

  async function send(value: string) {
    const message = value.trim()
    if (!message || loading) return
    const history = messages.slice(-8)
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setInput('')
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/ai/meteor-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, world }),
      })
      const data = await response.json() as { reply?: string; error?: string }
      if (!response.ok || !data.reply) throw new Error(data.error || 'Unable to get a reply')
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply! }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat unavailable')
    } finally { setLoading(false) }
  }

  return <aside aria-label="Space science AI chat" className="absolute bottom-24 left-3 top-3 z-30 flex w-[min(370px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-sky-300/30 bg-[#0d1729]/95 text-white shadow-2xl backdrop-blur-md sm:bottom-4 sm:left-4 sm:top-20">
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2"><Bot className="text-sky-300" size={21}/><div><h2 className="text-sm font-bold">Orbit AI · Science Chat</h2><p className="text-xs text-slate-300">Powered by Vultr · {world}</p></div></div>
      <button type="button" onClick={onClose} aria-label="Close AI chat" className="rounded-full p-2 hover:bg-white/10"><X size={18}/></button>
    </header>
    <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
      {messages.length === 0 && <div className="space-y-3"><div className="rounded-xl bg-sky-400/10 p-3 text-sm text-slate-200"><Sparkles size={16} className="mr-2 inline text-sky-300"/>Ask me about meteor impacts, craters, planetary gravity, or NASA fireballs.</div><div className="space-y-2">{PROMPTS.map(prompt => <button type="button" key={prompt} onClick={() => void send(prompt)} className="block w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left text-xs text-slate-100 hover:bg-white/10">{prompt}</button>)}</div></div>}
      {messages.map((item, index) => <div key={index} className={`max-w-[95%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${item.role === 'user' ? 'ml-auto bg-sky-600 text-white' : 'mr-auto bg-white/10 text-slate-100'}`}>{item.content}</div>)}
      {loading && <div className="flex items-center gap-2 text-xs text-slate-300"><LoaderCircle className="animate-spin" size={15}/> Orbit is thinking…</div>}
      {error && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-xs text-red-200">{error}</p>}
      <div ref={bottom}/>
    </div>
    <form onSubmit={e => { e.preventDefault(); void send(input) }} className="flex gap-2 border-t border-white/10 p-3">
      <input aria-label="Ask a space science question" value={input} onChange={e => setInput(e.target.value)} maxLength={1500} placeholder="Ask about meteor collisions…" className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400"/>
      <button type="submit" aria-label="Send question" disabled={loading || !input.trim()} className="rounded-full bg-sky-500 p-3 text-white hover:bg-sky-400 disabled:opacity-40"><Send size={16}/></button>
    </form>
    <p className="px-4 pb-3 text-[10px] text-slate-400">AI explanations may be imperfect. NASA event data is available separately in Meteor Lab.</p>
  </aside>
}
