import { Hono } from 'hono'
import type { Env } from '../types'

export const newsletter = new Hono<{ Bindings: Env }>()

// ============================================================================
// Schema D1 (executado via /admin/migrate)
// CREATE TABLE IF NOT EXISTS newsletter_subscribers (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   email TEXT NOT NULL UNIQUE,
//   status TEXT NOT NULL DEFAULT 'pending', -- pending | active | unsubscribed
//   token TEXT NOT NULL,
//   created_at TEXT NOT NULL DEFAULT (datetime('now')),
//   confirmed_at TEXT,
//   unsubscribed_at TEXT,
//   ip TEXT,
//   user_agent TEXT
// );
// CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);
// CREATE INDEX IF NOT EXISTS idx_newsletter_token  ON newsletter_subscribers(token);
// ============================================================================

const FROM_EMAIL = 'Observatório do Senado <noreply@observasenado.org>'
const REPLY_TO = 'contato@observasenado.org'
const SITE = 'https://observasenado.org'
const API_BASE = 'https://api.observasenado.org'

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200
}

function generateToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      return { ok: false, error: `Resend ${r.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function confirmHtml(token: string): string {
  const url = `${API_BASE}/api/newsletter/confirm?token=${token}`
  return `
<!doctype html>
<html lang="pt-BR"><body style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f7f6f3">
  <div style="border:1px solid #e2dfd8;background:#ffffff;padding:32px;border-radius:4px">
    <h1 style="font-family:Georgia,serif;color:#0F3D5C;margin:0 0 16px;font-size:22px">Confirme sua inscrição</h1>
    <p style="line-height:1.6;font-size:15px;color:#1a1a1a">Você solicitou o recebimento da newsletter do <strong>Observatório do Senado</strong>.</p>
    <p style="line-height:1.6;font-size:15px;color:#1a1a1a">Para confirmar sua inscrição, clique no botão abaixo:</p>
    <p style="margin:28px 0">
      <a href="${url}" style="display:inline-block;background:#0F3D5C;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:3px;font-size:14px;letter-spacing:0.05em;text-transform:uppercase">Confirmar inscrição</a>
    </p>
    <p style="line-height:1.6;font-size:13px;color:#5b6166">Se você não solicitou esta inscrição, ignore este e-mail.</p>
    <hr style="border:none;border-top:1px solid #e2dfd8;margin:24px 0">
    <p style="font-size:12px;color:#8a8e93;line-height:1.6">Observatório do Senado · Iniciativa cidadã independente de transparência parlamentar.<br><a href="${SITE}" style="color:#0F3D5C">observasenado.org</a></p>
  </div>
</body></html>`
}

function welcomeHtml(unsubToken: string): string {
  const url = `${API_BASE}/api/newsletter/unsubscribe?token=${unsubToken}`
  return `
<!doctype html>
<html lang="pt-BR"><body style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f7f6f3">
  <div style="border:1px solid #e2dfd8;background:#ffffff;padding:32px;border-radius:4px">
    <h1 style="font-family:Georgia,serif;color:#0F3D5C;margin:0 0 16px;font-size:22px">Inscrição confirmada</h1>
    <p style="line-height:1.6;font-size:15px">Bem-vindo(a) à newsletter do <strong>Observatório do Senado</strong>. Você receberá atualizações periódicas sobre o monitoramento parlamentar, mudanças metodológicas e novas funcionalidades da plataforma.</p>
    <p style="line-height:1.6;font-size:15px">Acesse o ranking completo em <a href="${SITE}" style="color:#0F3D5C">observasenado.org</a>.</p>
    <hr style="border:none;border-top:1px solid #e2dfd8;margin:24px 0">
    <p style="font-size:12px;color:#8a8e93;line-height:1.6">Para cancelar sua inscrição a qualquer momento, <a href="${url}" style="color:#0F3D5C">clique aqui</a>.</p>
  </div>
</body></html>`
}

function appendUnsubscribe(html: string, unsubToken: string): string {
  const url = `${API_BASE}/api/newsletter/unsubscribe?token=${unsubToken}`
  const footer = `<hr style="border:none;border-top:1px solid #e2dfd8;margin:32px 0 16px"><p style="font-size:11px;color:#8a8e93;line-height:1.6;text-align:center">Você está recebendo este e-mail porque se inscreveu na newsletter do Observatório do Senado.<br><a href="${url}" style="color:#5b6166">Cancelar inscrição</a> · <a href="${SITE}" style="color:#5b6166">observasenado.org</a></p>`
  if (html.includes('</body>')) return html.replace('</body>', `${footer}</body>`)
  return html + footer
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

newsletter.post('/subscribe', async (c) => {
  const body = (await c.req.json<{ email?: string }>().catch(() => ({}))) as { email?: string }
  const email = (body.email ?? '').trim().toLowerCase()

  if (!isValidEmail(email)) {
    return c.json({ error: 'E-mail inválido.' }, 400)
  }

  const token = generateToken()
  const ip = c.req.header('cf-connecting-ip') ?? null
  const ua = c.req.header('user-agent') ?? null

  // Idempotente: se já está active, finge que mandou (privacy)
  const existing = await c.env.SENADO_DB.prepare(
    'SELECT status FROM newsletter_subscribers WHERE email = ?',
  )
    .bind(email)
    .first<{ status: string }>()

  if (existing?.status === 'active') {
    return c.json({ ok: true, message: 'Verifique seu e-mail para confirmar a inscrição.' })
  }

  await c.env.SENADO_DB.prepare(
    `INSERT INTO newsletter_subscribers (email, status, token, ip, user_agent)
     VALUES (?, 'pending', ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET token=excluded.token, status='pending', ip=excluded.ip, user_agent=excluded.user_agent`,
  )
    .bind(email, token, ip, ua)
    .run()

  if (c.env.RESEND_API_KEY) {
    const send = await sendEmailViaResend(
      c.env.RESEND_API_KEY,
      email,
      'Confirme sua inscrição — Observatório do Senado',
      confirmHtml(token),
    )
    if (!send.ok) {
      console.error('newsletter confirm send failed:', send.error)
    }
  }

  return c.json({ ok: true, message: 'Verifique seu e-mail para confirmar a inscrição.' })
})

newsletter.get('/confirm', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!token) return c.html(htmlMessage('Link inválido', 'O link de confirmação está incompleto.'), 400)

  const row = await c.env.SENADO_DB.prepare(
    'SELECT id, email, status FROM newsletter_subscribers WHERE token = ?',
  )
    .bind(token)
    .first<{ id: number; email: string; status: string }>()

  if (!row) return c.html(htmlMessage('Link inválido', 'Este link não é mais válido.'), 404)

  if (row.status !== 'active') {
    await c.env.SENADO_DB.prepare(
      `UPDATE newsletter_subscribers SET status='active', confirmed_at=datetime('now') WHERE id=?`,
    )
      .bind(row.id)
      .run()

    if (c.env.RESEND_API_KEY) {
      await sendEmailViaResend(
        c.env.RESEND_API_KEY,
        row.email,
        'Inscrição confirmada — Observatório do Senado',
        welcomeHtml(token),
      )
    }
  }

  return c.html(
    htmlMessage(
      'Inscrição confirmada',
      'Obrigado por se inscrever na newsletter do Observatório do Senado. Você receberá nossas próximas atualizações.',
    ),
  )
})

newsletter.get('/unsubscribe', async (c) => {
  const token = c.req.query('token') ?? ''
  if (!token) return c.html(htmlMessage('Link inválido', 'O link de cancelamento está incompleto.'), 400)

  const row = await c.env.SENADO_DB.prepare(
    'SELECT id, status FROM newsletter_subscribers WHERE token = ?',
  )
    .bind(token)
    .first<{ id: number; status: string }>()

  if (!row) return c.html(htmlMessage('Link inválido', 'Este link não é mais válido.'), 404)

  await c.env.SENADO_DB.prepare(
    `UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=datetime('now') WHERE id=?`,
  )
    .bind(row.id)
    .run()

  return c.html(
    htmlMessage(
      'Inscrição cancelada',
      'Sua inscrição foi cancelada. Você não receberá mais e-mails do Observatório do Senado.',
    ),
  )
})

// ============================================================================
// ADMIN ENDPOINTS (requer X-Admin-Secret)
// ============================================================================

function requireAdmin(c: any): Response | null {
  const provided = c.req.header('x-admin-secret')
  if (!c.env.ADMIN_SECRET || provided !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  return null
}

newsletter.get('/admin/stats', async (c) => {
  const unauth = requireAdmin(c)
  if (unauth) return unauth

  const r = await c.env.SENADO_DB.prepare(
    `SELECT status, COUNT(*) as n FROM newsletter_subscribers GROUP BY status`,
  ).all<{ status: string; n: number }>()

  const stats = { pending: 0, active: 0, unsubscribed: 0, total: 0 }
  for (const row of r.results) {
    ;(stats as any)[row.status] = row.n
    stats.total += row.n
  }
  return c.json(stats)
})

newsletter.post('/admin/send', async (c) => {
  const unauth = requireAdmin(c)
  if (unauth) return unauth

  const body = (await c.req
    .json<{ subject?: string; html?: string; test_to?: string }>()
    .catch(() => ({}))) as { subject?: string; html?: string; test_to?: string }

  if (!body.subject || !body.html) {
    return c.json({ error: 'subject and html are required' }, 400)
  }
  if (!c.env.RESEND_API_KEY) {
    return c.json({ error: 'RESEND_API_KEY not configured' }, 500)
  }

  // Modo teste: envia só pra um e-mail
  if (body.test_to) {
    if (!isValidEmail(body.test_to)) return c.json({ error: 'invalid test_to' }, 400)
    const tmpToken = generateToken()
    const send = await sendEmailViaResend(
      c.env.RESEND_API_KEY,
      body.test_to,
      `[TESTE] ${body.subject}`,
      appendUnsubscribe(body.html, tmpToken),
    )
    return c.json({ test: true, ok: send.ok, error: send.error })
  }

  const subs = await c.env.SENADO_DB.prepare(
    `SELECT email, token FROM newsletter_subscribers WHERE status='active'`,
  ).all<{ email: string; token: string }>()

  let sent = 0
  let failed = 0
  const errors: string[] = []

  // Rate limit suave: ~10 emails por segundo (Resend free = 2/s, paid = 10/s)
  for (const s of subs.results) {
    const r = await sendEmailViaResend(
      c.env.RESEND_API_KEY,
      s.email,
      body.subject,
      appendUnsubscribe(body.html, s.token),
    )
    if (r.ok) sent++
    else {
      failed++
      if (errors.length < 10) errors.push(`${s.email}: ${r.error}`)
    }
    await new Promise((res) => setTimeout(res, 120))
  }

  return c.json({ sent, failed, total: subs.results.length, errors })
})

// ============================================================================
// helpers
// ============================================================================

function htmlMessage(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${title} — Observatório do Senado</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,Arial,sans-serif;background:#f7f6f3;color:#1a1a1a;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:520px;width:100%;background:#fff;border:1px solid #e2dfd8;border-radius:4px;padding:40px;text-align:center}
h1{font-family:Georgia,serif;color:#0F3D5C;margin:0 0 16px;font-size:22px}
p{line-height:1.6;font-size:15px;color:#1a1a1a;margin:8px 0}
a{color:#0F3D5C;text-decoration:none;font-weight:500}
.foot{margin-top:24px;padding-top:16px;border-top:1px solid #e2dfd8;font-size:12px;color:#8a8e93}
</style></head>
<body><div class="card">
<h1>${title}</h1>
<p>${body}</p>
<p class="foot"><a href="${SITE}">← Voltar para observasenado.org</a></p>
</div></body></html>`
}
