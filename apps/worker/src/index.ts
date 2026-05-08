import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ranking } from './routes/ranking'
import { senador } from './routes/senador'
import { ceap } from './routes/ceap'
import { newsletter } from './routes/newsletter'
import { computeRanking, persistRanking, getLatestRanking } from './services/ranking'
import { getSenadorList, getRawDimensions, mesesAtivos } from './services/legis'
import { getCeapLeg57, getAuxiliosMoradia } from './services/adm'
import { gerarPreview, enviarEdicao } from './services/newsletter'
import type { Env } from './types'

export const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: [
      'https://observasenado.pages.dev',
      'https://observasenado.org',
      'https://www.observasenado.org',
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 86400,
  }),
)

app.get('/health', async (c) => {
  const scores = await getLatestRanking(c.env)
  const dims = [
    'dimProdutividade',
    'dimEfetividade',
    'dimParticipacao',
    'dimFiscalizacao',
    'dimCeap',
    'dimTransparencia',
  ] as const
  const modePct: Record<string, number> = {}
  let dimensionsHealthy = true
  if (scores.length > 0) {
    for (const dim of dims) {
      const counts = new Map<number, number>()
      for (const s of scores) {
        const v = (s as unknown as Record<string, number>)[dim]
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      const top = Math.max(...counts.values())
      const pct = top / scores.length
      modePct[dim] = Math.round(pct * 1000) / 10
      if (pct > 0.5 || counts.size <= 5) dimensionsHealthy = false
    }
  } else {
    dimensionsHealthy = false
  }
  return c.json({
    status: 'ok',
    ts: new Date().toISOString(),
    ranking_count: scores.length,
    ranking_ready: scores.length > 0,
    dimensions_healthy: dimensionsHealthy,
    mode_pct: modePct,
  })
})

app.route('/api/ranking', ranking)
app.route('/api/senador', senador)
app.route('/api/ceap', ceap)
app.route('/api/newsletter', newsletter)

// Endpoint admin: dispara recálculo manual (autenticado via X-Admin-Secret)
app.post('/admin/recalculate', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  try {
    const scores = await computeRanking(c.env)
    await persistRanking(c.env, scores)
    return c.json({
      status: 'ok',
      ranking_count: scores.length,
      computed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[admin/recalculate] erro:', err)
    return c.json(
      { error: 'recalc failed', detail: String(err) },
      500,
    )
  }
})

// Warmup: popula KV cache em chunks (workaround p/ limite de 1000 subrequests)
// Uso: POST /admin/warmup?offset=0&limit=20
app.post('/admin/warmup', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const offset = Number(c.req.query('offset') ?? '0')
  const limit = Number(c.req.query('limit') ?? '5')

  try {
    // Pré-aquece auxiliares globais 1 vez (CEAP + auxilio moradia)
    if (offset === 0) {
      await Promise.allSettled([
        getCeapLeg57(c.env),
        getAuxiliosMoradia(c.env),
      ])
    }

    const senadores = await getSenadorList(c.env)
    const slice = senadores.slice(offset, offset + limit)

    const results = await Promise.allSettled(
      slice.map((s) => getRawDimensions(c.env, s.codigo)),
    )

    // Persiste rawDimensions consolidado por senador (1 chave KV por sen)
    // Permite que /admin/recalculate funcione com poucos subrequests
    let ok = 0
    let fail = 0
    let suspeitos = 0
    await Promise.all(
      results.map(async (r, idx) => {
        if (r.status !== 'fulfilled') {
          fail += 1
          return
        }
        const sen = slice[idx]
        const v = r.value
        // Guarda anti cache-poisoning: senador veterano (>3 meses) sem
        // NENHUM sinal em 4 dimensões independentes é quase certamente
        // cascata de fetches falhos, não realidade.
        const meses = mesesAtivos(sen.dataInicioExercicio ?? '2023-02-01')
        const semSinal =
          v.efetividadeBase === 0 &&
          v.relatoriasTotal === 0 &&
          v.discursosTotal === 0 &&
          v.votacoesTotal <= 1
        if (meses > 3 && semSinal) {
          suspeitos += 1
          fail += 1
          return
        }
        await c.env.SENADO_CACHE.put(
          `raw:v2:${sen.codigo}`,
          JSON.stringify(v),
          { expirationTtl: 8 * 24 * 60 * 60 }, // 8 dias > 1 semana
        )
        ok += 1
      }),
    )

    return c.json({
      status: 'ok',
      offset,
      processed: slice.length,
      ok,
      fail,
      suspeitos,
      next_offset: offset + slice.length,
      total: senadores.length,
      done: offset + slice.length >= senadores.length,
    })
  } catch (err) {
    console.error('[admin/warmup] erro:', err)
    return c.json({ error: 'warmup failed', detail: String(err) }, 500)
  }
})

// Purge de caches específicos (KV) — útil após mudanças de classificação
// Uso: POST /admin/purge?keys=raw,processos,cargos&offset=0&limit=15
app.post('/admin/purge', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const keysParam = String(
    c.req.query('keys') ?? 'raw,processos,cargos,liderancas',
  )
  const targets = keysParam.split(',').map((k) => k.trim())
  const offset = Number(c.req.query('offset') ?? '0')
  const limit = Number(c.req.query('limit') ?? '15')

  const senadores = await getSenadorList(c.env)
  const slice = senadores.slice(offset, offset + limit)
  let deleted = 0
  await Promise.all(
    slice.map(async (s) => {
      const ks: string[] = []
      if (targets.includes('raw')) ks.push(`raw:v2:${s.codigo}`)
      if (targets.includes('processos'))
        ks.push(`legis:${s.codigo}:processos:leg57`)
      if (targets.includes('cargos')) ks.push(`legis:${s.codigo}:cargos`)
      if (targets.includes('liderancas'))
        ks.push(`legis:${s.codigo}:liderancas`)
      await Promise.all(ks.map((k) => c.env.SENADO_CACHE.delete(k)))
      deleted += ks.length
    }),
  )
  return c.json({
    status: 'ok',
    deleted,
    targets,
    offset,
    processed: slice.length,
    next_offset: offset + slice.length,
    total: senadores.length,
    done: offset + slice.length >= senadores.length,
  })
})

// Migrações manuais via admin (D1) — idempotentes
app.post('/admin/migrate', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const migrations = [
    `ALTER TABLE ranking_snapshots ADD COLUMN votacoes_comissao_presentes INTEGER DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN votacoes_comissao_total INTEGER DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN ceap_divulgacao REAL DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN ceap_escritorio REAL DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN ceap_locomocao REAL DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN ceap_consultoria REAL DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN ceap_outros REAL DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN pct_divulgacao REAL DEFAULT 0`,
    `ALTER TABLE ranking_snapshots ADD COLUMN escritorios_count INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT,
      unsubscribed_at TEXT,
      ip TEXT,
      user_agent TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status)`,
    `CREATE INDEX IF NOT EXISTS idx_newsletter_token  ON newsletter_subscribers(token)`,
    // IDS v3
    `ALTER TABLE ranking_snapshots ADD COLUMN status TEXT`,
    `ALTER TABLE ranking_snapshots ADD COLUMN confianca TEXT`,
    `ALTER TABLE ranking_snapshots ADD COLUMN ids_total_bruto REAL`,
    `CREATE INDEX IF NOT EXISTS idx_ranking_status ON ranking_snapshots(status)`,
    // Newsletter runs (auditoria + idempotência semanal)
    `CREATE TABLE IF NOT EXISTS newsletter_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now')),
      edicao TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      preheader TEXT,
      html TEXT NOT NULL,
      markdown TEXT NOT NULL,
      prompt_tokens INTEGER,
      output_tokens INTEGER,
      modelo TEXT,
      status TEXT NOT NULL DEFAULT 'preview',
      enviados INTEGER DEFAULT 0,
      falhas INTEGER DEFAULT 0,
      enviado_em TEXT,
      aprovado_em TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_newsletter_runs_status ON newsletter_runs(status)`,
  ]
  const results: { sql: string; ok: boolean; err?: string }[] = []
  for (const sql of migrations) {
    try {
      await c.env.SENADO_DB.prepare(sql).run()
      results.push({ sql, ok: true })
    } catch (err) {
      const msg = String(err)
      // duplicate column name = já aplicado
      const dup = msg.includes('duplicate column name') || msg.includes('already exists')
      results.push({ sql, ok: dup, err: dup ? 'already-applied' : msg })
    }
  }
  return c.json({ status: 'ok', results })
})

// Newsletter — admin only
app.post('/admin/newsletter/preview', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) return c.json({ error: 'Unauthorized' }, 401)
  const forcar = c.req.query('forcar') === '1'
  try {
    const p = await gerarPreview(c.env, forcar)
    const accept = c.req.header('Accept') ?? ''
    if (accept.includes('text/html')) {
      return c.html(p.html)
    }
    return c.json({
      edicao: p.edicao,
      subject: p.subject,
      preheader: p.preheader,
      modelo: p.modelo,
      promptTokens: p.promptTokens,
      outputTokens: p.outputTokens,
      status: p.status,
      reused: p.reused,
      markdown: p.markdown,
      // html omitido do JSON por tamanho — pegar via Accept: text/html
    })
  } catch (err) {
    console.error('[admin/newsletter/preview]', err)
    return c.json({ error: 'preview failed', detail: String(err) }, 500)
  }
})

app.post('/admin/newsletter/enviar', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (!secret || secret !== c.env.ADMIN_SECRET) return c.json({ error: 'Unauthorized' }, 401)
  const edicao = c.req.query('edicao')
  if (!edicao) return c.json({ error: 'edicao obrigatória' }, 400)
  const adminOnly = c.req.query('adminOnly') === '1'
  const adminEmail = c.req.query('email') ?? undefined
  try {
    const r = await enviarEdicao(c.env, edicao, { adminOnly, adminEmail })
    return c.json(r)
  } catch (err) {
    console.error('[admin/newsletter/enviar]', err)
    return c.json({ error: 'envio falhou', detail: String(err) }, 500)
  }
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error('[worker error]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx)
  },

  // Cron: roda 1x por semana, domingos às 03:00 UTC
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        console.log('[cron] Iniciando recálculo semanal do ranking IDS...')
        try {
          const scores = await computeRanking(env)
          await persistRanking(env, scores)
          console.log(`[cron] OK — ${scores.length} senadores calculados`)
        } catch (err) {
          console.error('[cron] Erro:', err)
        }
      })(),
    )
  },
}
