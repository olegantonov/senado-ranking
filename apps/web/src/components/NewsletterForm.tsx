'use client'

import { useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.observasenado.org'

export default function NewsletterForm({
  variant = 'block',
}: {
  variant?: 'block' | 'inline'
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string>('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setMsg('')
    try {
      const r = await fetch(`${API}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setStatus('err')
        setMsg(data.error ?? 'Não foi possível processar sua inscrição.')
        return
      }
      setStatus('ok')
      setMsg(data.message ?? 'Verifique seu e-mail para confirmar a inscrição.')
      setEmail('')
    } catch (err) {
      setStatus('err')
      setMsg('Falha de conexão. Tente novamente.')
    }
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
          aria-label="E-mail"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-sm bg-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {status === 'loading' ? 'Enviando…' : 'Inscrever-se'}
        </button>
        {msg && (
          <p
            className={`text-xs sm:basis-full ${
              status === 'ok' ? 'text-success' : 'text-danger'
            }`}
          >
            {msg}
          </p>
        )}
      </form>
    )
  }

  return (
    <div className="rounded-sm border border-border bg-panel px-6 py-6">
      <p className="eyebrow">Newsletter</p>
      <h3 className="mt-2 font-serif text-xl font-semibold text-ink">
        Receba atualizações periódicas
      </h3>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        Acompanhe mudanças no ranking, atualizações metodológicas e novas
        funcionalidades da plataforma. Sem spam — você pode cancelar a
        inscrição a qualquer momento.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
          aria-label="E-mail"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-sm bg-primary px-5 py-2 text-xs font-medium uppercase tracking-wider text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {status === 'loading' ? 'Enviando…' : 'Inscrever-se'}
        </button>
      </form>
      {msg && (
        <p
          className={`mt-3 text-xs ${
            status === 'ok' ? 'text-success' : 'text-danger'
          }`}
        >
          {msg}
        </p>
      )}
      <p className="mt-3 text-[11px] text-subtle leading-relaxed">
        Ao se inscrever, você concorda com nossa{' '}
        <a href="/privacidade" className="underline hover:text-primary">
          Política de Privacidade
        </a>
        .
      </p>
    </div>
  )
}
