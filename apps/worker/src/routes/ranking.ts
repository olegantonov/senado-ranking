import { Hono } from 'hono'
import type { Env } from '../types'
import { getLatestRanking, computeRanking, persistRanking } from '../services/ranking'

const ranking = new Hono<{ Bindings: Env }>()

ranking.get('/', async (c) => {
  const scores = await getLatestRanking(c.env)

  const partido = c.req.query('partido')
  const uf = c.req.query('uf')
  const bloco = c.req.query('bloco')

  let result = scores
  if (partido) result = result.filter((s) => s.partido === partido.toUpperCase())
  if (uf) result = result.filter((s) => s.uf === uf.toUpperCase())
  if (bloco) result = result.filter((s) => s.bloco.toLowerCase().includes(bloco.toLowerCase()))

  return c.json({
    total: result.length,
    computedAt: scores[0]?.senadorCod ? new Date().toISOString() : null,
    empty: scores.length === 0,
    data: result,
  }, 200, {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600',
  })
})

ranking.get('/meta', async (c) => {
  const scores = await getLatestRanking(c.env)
  const partidos = [...new Set(scores.map((s) => s.partido).filter(Boolean))].sort()
  const ufs = [...new Set(scores.map((s) => s.uf).filter(Boolean))].sort()
  const blocos = [...new Set(scores.map((s) => s.bloco).filter(Boolean))].sort()
  return c.json({ partidos, ufs, blocos }, 200, {
    'Cache-Control': 'public, max-age=3600',
  })
})

// Endpoint admin para forçar recálculo (chamado pelo cron ou manualmente)
ranking.post('/recalcular', async (c) => {
  const secret = c.req.header('X-Admin-Secret')
  if (secret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  try {
    const scores = await computeRanking(c.env)
    await persistRanking(c.env, scores)  // síncrono — garante persistência antes de retornar
    return c.json({ ok: true, total: scores.length })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

export { ranking }
