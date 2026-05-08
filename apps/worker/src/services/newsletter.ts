/**
 * Orquestrador da newsletter: gera (preview) ou envia.
 *
 * Modos:
 *   gerarPreview(env, edicao?)    — gera markdown+html, salva como status='preview'
 *                                   se já existir 'sent' para a edição, retorna o existente
 *   enviarEdicao(env, edicao, modoAdminOnly?)
 *                                  — envia para subscribers active via Resend
 *                                  — modoAdminOnly=true: envia só para email do admin (preview por mail)
 */

import type { Env } from '../types'
import { coletarDadosSemanais } from './newsletter-data'
import { gerarAnalise } from './newsletter-ai'
import { renderNewsletter } from './newsletter-html'

export interface NewsletterPreview {
  edicao: string
  subject: string
  preheader: string
  markdown: string
  html: string
  modelo: string
  promptTokens?: number
  outputTokens?: number
  status: 'preview' | 'sent'
  reused: boolean
}

export interface NewsletterEnvioResult {
  edicao: string
  enviados: number
  falhas: number
  rejeitados: string[]
  status: 'sent'
}

const SITE = 'https://observasenado.org'

interface NewsletterRunRow {
  edicao: string
  subject: string
  preheader: string | null
  html: string
  markdown: string
  prompt_tokens: number | null
  output_tokens: number | null
  modelo: string | null
  status: string
}

export async function gerarPreview(env: Env, forcarRegerar = false): Promise<NewsletterPreview> {
  const data = await coletarDadosSemanais(env)

  // Idempotência: se já existe run para essa edição, reaproveita
  const existente = await env.SENADO_DB.prepare(
    `SELECT * FROM newsletter_runs WHERE edicao = ?`,
  ).bind(data.edicao).first<NewsletterRunRow>()

  if (existente && !forcarRegerar) {
    return {
      edicao: existente.edicao,
      subject: existente.subject,
      preheader: existente.preheader ?? '',
      markdown: existente.markdown,
      html: existente.html,
      modelo: existente.modelo ?? '',
      promptTokens: existente.prompt_tokens ?? undefined,
      outputTokens: existente.output_tokens ?? undefined,
      status: (existente.status as 'preview' | 'sent') ?? 'preview',
      reused: true,
    }
  }

  const ai = await gerarAnalise(env, data)
  const html = renderNewsletter(data, ai.markdown)

  if (existente && forcarRegerar) {
    await env.SENADO_DB.prepare(
      `UPDATE newsletter_runs SET subject=?, preheader=?, html=?, markdown=?, prompt_tokens=?, output_tokens=?, modelo=?, computed_at=datetime('now') WHERE edicao=?`,
    ).bind(html.subject, html.preheader, html.html, ai.markdown, ai.promptTokens ?? null, ai.outputTokens ?? null, ai.modelo, data.edicao).run()
  } else {
    await env.SENADO_DB.prepare(
      `INSERT INTO newsletter_runs (edicao, subject, preheader, html, markdown, prompt_tokens, output_tokens, modelo, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'preview')`,
    ).bind(data.edicao, html.subject, html.preheader, html.html, ai.markdown, ai.promptTokens ?? null, ai.outputTokens ?? null, ai.modelo).run()
  }

  return {
    edicao: data.edicao,
    subject: html.subject,
    preheader: html.preheader,
    markdown: ai.markdown,
    html: html.html,
    modelo: ai.modelo,
    promptTokens: ai.promptTokens,
    outputTokens: ai.outputTokens,
    status: 'preview',
    reused: false,
  }
}

interface Subscriber { id: number; email: string; token: string }

async function listarSubscribersAtivos(env: Env): Promise<Subscriber[]> {
  const rows = await env.SENADO_DB.prepare(
    `SELECT id, email, token FROM newsletter_subscribers WHERE status = 'active'`,
  ).all<{ id: number; email: string; token: string }>()
  return rows.results ?? []
}

async function enviarEmail(env: Env, to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, error: 'RESEND_API_KEY não configurada' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Observatório do Senado <newsletter@observasenado.org>',
        to: [to],
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: `Resend ${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function enviarEdicao(
  env: Env,
  edicao: string,
  opts: { adminOnly?: boolean; adminEmail?: string } = {},
): Promise<NewsletterEnvioResult> {
  const run = await env.SENADO_DB.prepare(
    `SELECT * FROM newsletter_runs WHERE edicao = ?`,
  ).bind(edicao).first<NewsletterRunRow>()
  if (!run) throw new Error(`Edição ${edicao} não encontrada — gere preview primeiro`)
  if (run.status === 'sent' && !opts.adminOnly) throw new Error(`Edição ${edicao} já foi enviada`)

  // Texto plain-text — extraímos do html (simples) ou regeramos
  const text = htmlToPlainText(run.html)

  const destinatarios = opts.adminOnly
    ? [{ id: -1, email: opts.adminEmail ?? '', token: 'preview' }]
    : await listarSubscribersAtivos(env)

  if (destinatarios.length === 0) {
    return { edicao, enviados: 0, falhas: 0, rejeitados: [], status: 'sent' }
  }

  let ok = 0
  let fail = 0
  const rejeitados: string[] = []

  // Rate limit ~10/s (Resend paid). Espera 100ms entre envios.
  for (const sub of destinatarios) {
    if (!sub.email) continue
    const html = run.html
      .replace(/{{UNSUBSCRIBE_URL}}/g, `${SITE}/api/newsletter/unsubscribe?token=${encodeURIComponent(sub.token)}`)
    const r = await enviarEmail(env, sub.email, run.subject, html, text)
    if (r.ok) ok += 1
    else { fail += 1; rejeitados.push(`${sub.email}: ${r.error ?? 'erro'}`) }
    await new Promise((res) => setTimeout(res, 110))
  }

  if (!opts.adminOnly) {
    await env.SENADO_DB.prepare(
      `UPDATE newsletter_runs SET status='sent', enviados=?, falhas=?, enviado_em=datetime('now') WHERE edicao=?`,
    ).bind(ok, fail, edicao).run()
  }

  return { edicao, enviados: ok, falhas: fail, rejeitados, status: 'sent' }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}
