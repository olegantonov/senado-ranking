import { Hono } from 'hono'
import type { Env } from '../types'
import { getLatestRanking } from '../services/ranking'
import { getSenadorList } from '../services/legis'

const senador = new Hono<{ Bindings: Env }>()

senador.get('/:codigo', async (c) => {
  const codigo = c.req.param('codigo')

  const [scores, lista] = await Promise.all([
    getLatestRanking(c.env),
    getSenadorList(c.env),
  ])

  const score = scores.find((s) => s.senadorCod === codigo)
  const info = lista.find((s) => s.codigo === codigo)

  if (!score && !info) {
    return c.json({ error: 'Senador não encontrado' }, 404)
  }

  const posicao = score ? scores.indexOf(score) + 1 : null

  return c.json(
    {
      ...score,
      ...info,
      posicao,
      totalSenadores: scores.length,
    },
    200,
    { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300' },
  )
})

export { senador }
