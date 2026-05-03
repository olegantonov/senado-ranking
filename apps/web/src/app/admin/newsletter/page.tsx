'use client'

import { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.observasenado.org'
const SECRET_KEY = 'observa_admin_secret_v1'

const DEFAULT_MD = `# Atualização do Observatório

Olá,

Este é um exemplo de boletim. Use **markdown** para formatar.

- Item um
- Item dois
- Item três

[Acesse o ranking →](https://observasenado.org)

---

*Equipe do Observatório do Senado*
`

function wrapHtml(innerHtml: string, subject: string): string {
  // Template institucional — petróleo + dourado, tipografia editorial
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f7f6f3;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2dfd8;border-radius:4px;overflow:hidden">
    <tr><td style="padding:24px 32px;border-bottom:3px solid #C9A24B;background:#0F3D5C;color:#ffffff">
      <table role="presentation" width="100%"><tr>
        <td style="font-family:Georgia,serif;font-size:18px;font-weight:600;letter-spacing:0.02em">Observatório do Senado</td>
        <td align="right" style="font-family:system-ui,Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#C9A24B">Boletim</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px;font-size:16px;line-height:1.7;color:#1a1a1a">
      <div class="content">${innerHtml}</div>
    </td></tr>
  </table>
  <table role="presentation" align="center" width="600" style="max-width:600px;width:100%;margin-top:8px"><tr>
    <td style="padding:16px 32px;font-family:system-ui,Arial,sans-serif;font-size:11px;color:#8a8e93;line-height:1.6;text-align:center">
      Iniciativa cidadã independente · sem vínculo partidário · <a href="https://observasenado.org" style="color:#0F3D5C;text-decoration:none">observasenado.org</a>
    </td>
  </tr></table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))
}

export default function AdminNewsletterPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [stats, setStats] = useState<{ pending: number; active: number; unsubscribed: number; total: number } | null>(null)
  const [subject, setSubject] = useState('')
  const [md, setMd] = useState(DEFAULT_MD)
  const [testTo, setTestTo] = useState('')
  const [busy, setBusy] = useState<'idle' | 'test' | 'send'>('idle')
  const [log, setLog] = useState<string>('')

  // Render markdown -> sanitized HTML
  const innerHtml = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const raw = marked.parse(md, { async: false }) as string
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
  }, [md])

  const fullHtml = useMemo(
    () => wrapHtml(innerHtml, subject || 'Observatório do Senado'),
    [innerHtml, subject],
  )

  useEffect(() => {
    const s = localStorage.getItem(SECRET_KEY)
    if (s) {
      setSecret(s)
      void tryAuth(s)
    }
  }, [])

  async function tryAuth(s: string): Promise<boolean> {
    try {
      const r = await fetch(`${API}/api/newsletter/admin/stats`, {
        headers: { 'X-Admin-Secret': s },
      })
      if (!r.ok) return false
      const data = await r.json()
      setStats(data)
      setAuthed(true)
      localStorage.setItem(SECRET_KEY, s)
      return true
    } catch {
      return false
    }
  }

  async function refreshStats() {
    if (!secret) return
    const r = await fetch(`${API}/api/newsletter/admin/stats`, {
      headers: { 'X-Admin-Secret': secret },
    })
    if (r.ok) setStats(await r.json())
  }

  async function send(mode: 'test' | 'all') {
    if (!subject.trim() || !md.trim()) {
      alert('Preencha assunto e conteúdo.')
      return
    }
    if (mode === 'test' && !testTo.trim()) {
      alert('Informe um e-mail para o teste.')
      return
    }
    if (mode === 'all') {
      const n = stats?.active ?? 0
      if (!confirm(`Enviar para ${n} inscritos ativos? Esta ação não pode ser desfeita.`)) return
    }
    setBusy(mode === 'all' ? 'send' : 'test')
    setLog('Enviando...')
    try {
      const r = await fetch(`${API}/api/newsletter/admin/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': secret,
        },
        body: JSON.stringify({
          subject,
          html: fullHtml,
          test_to: mode === 'test' ? testTo.trim() : undefined,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        setLog(`Erro ${r.status}: ${JSON.stringify(data)}`)
      } else {
        setLog(JSON.stringify(data, null, 2))
        if (mode === 'all') void refreshStats()
      }
    } catch (err) {
      setLog(`Falha de conexão: ${String(err)}`)
    } finally {
      setBusy('idle')
    }
  }

  function logout() {
    localStorage.removeItem(SECRET_KEY)
    setSecret('')
    setAuthed(false)
    setStats(null)
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto py-12">
        <p className="eyebrow">Restrito</p>
        <h1 className="font-serif text-2xl text-ink mt-2">Admin · Newsletter</h1>
        <p className="mt-2 text-sm text-muted">Informe o ADMIN_SECRET para continuar.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await tryAuth(secret)
            if (!ok) alert('Secret inválido.')
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-sm bg-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-white hover:bg-primary-hover transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="font-serif text-2xl text-ink mt-1">Newsletter</h1>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="text-sm text-muted">
              <span className="font-semibold text-ink">{stats.active}</span> ativos ·{' '}
              <span className="text-subtle">{stats.pending} pendentes</span> ·{' '}
              <span className="text-subtle">{stats.unsubscribed} cancelados</span>
            </div>
          )}
          <button
            onClick={refreshStats}
            className="text-xs text-muted hover:text-primary underline"
          >
            atualizar
          </button>
          <button
            onClick={logout}
            className="text-xs text-muted hover:text-danger underline"
          >
            sair
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Assunto
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Boletim — Outubro/2026"
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-muted mb-1">
              Conteúdo (Markdown)
            </label>
            <textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              rows={22}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
              spellCheck
            />
            <p className="mt-1 text-[11px] text-subtle">
              Suporte a títulos, listas, links, negrito, itálico, citações, código.
              O footer com unsubscribe é adicionado automaticamente pelo servidor.
            </p>
          </div>

          <div className="rounded-sm border border-border bg-panel px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted mb-2">
              Enviar teste
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="seu@email.com"
                className="flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm"
              />
              <button
                onClick={() => send('test')}
                disabled={busy !== 'idle'}
                className="rounded-sm border border-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-60"
              >
                {busy === 'test' ? 'Enviando…' : 'Enviar teste'}
              </button>
            </div>
          </div>

          <div className="rounded-sm border border-danger/40 bg-danger/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-danger mb-2">
              Disparo final
            </p>
            <p className="text-xs text-muted mb-3">
              Envia para todos os <strong>{stats?.active ?? 0}</strong> inscritos
              confirmados. Cada e-mail terá link de cancelamento individual.
            </p>
            <button
              onClick={() => send('all')}
              disabled={busy !== 'idle' || !stats?.active}
              className="rounded-sm bg-danger px-5 py-2 text-xs font-medium uppercase tracking-wider text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === 'send' ? 'Enviando…' : `Enviar para ${stats?.active ?? 0} inscritos`}
            </button>
          </div>

          {log && (
            <pre className="rounded-sm border border-border bg-panel px-3 py-2 text-[11px] font-mono text-muted whitespace-pre-wrap max-h-48 overflow-auto">
              {log}
            </pre>
          )}
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted mb-2">
            Pré-visualização
          </p>
          <div className="rounded-sm border border-border bg-white overflow-hidden">
            <iframe
              title="preview"
              srcDoc={fullHtml}
              className="w-full h-[820px] bg-white"
              sandbox=""
            />
          </div>
        </div>
      </div>
    </div>
  )
}
