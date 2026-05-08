import { Hono } from 'hono'
import type { Env, IdsScore } from '../types'
import { getLatestRanking, computeRanking, persistRanking } from '../services/ranking'
import { getAfastadosFull } from '../services/legis'

const ranking = new Hono<{ Bindings: Env }>()

type FilterPreset = 'geral' | 'ativos' | 'titulares' | 'suplentes' | 'recentes' | 'afastados'

function applyFilterPreset(scores: IdsScore[], filter: FilterPreset): IdsScore[] {
  switch (filter) {
    case 'ativos':
      return scores.filter((s) => s.status !== 'afastado')
    case 'titulares':
      return scores.filter(
        (s) => s.status === 'titular_pleno' || s.status === 'titular_voltou',
      )
    case 'suplentes':
      return scores.filter(
        (s) => s.status === 'suplente_efetivo' || s.status === 'suplente_recente',
      )
    case 'recentes':
      return scores.filter((s) => s.status === 'recente' || (s.mesesAtivos ?? 0) < 6)
    case 'geral':
    default:
      return scores
  }
}

function ordenarScores(scores: IdsScore[], ordenar: string): IdsScore[] {
  const arr = [...scores]
  switch (ordenar) {
    case 'nome':
      return arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    case 'partido':
      return arr.sort((a, b) => a.partido.localeCompare(b.partido) || b.idsTotal - a.idsTotal)
    case 'uf':
      return arr.sort((a, b) => a.uf.localeCompare(b.uf) || b.idsTotal - a.idsTotal)
    case 'meses':
      return arr.sort((a, b) => (b.mesesAtivos ?? 0) - (a.mesesAtivos ?? 0))
    case 'ids_bruto':
      return arr.sort((a, b) => (b.idsTotalBruto ?? 0) - (a.idsTotalBruto ?? 0))
    case 'ids':
    default:
      return arr.sort((a, b) => b.idsTotal - a.idsTotal)
  }
}

ranking.get('/', async (c) => {
  const filter = (c.req.query('filter') ?? 'geral') as FilterPreset
  const status = c.req.query('status')
  const partido = c.req.query('partido')
  const uf = c.req.query('uf')
  const bloco = c.req.query('bloco')
  const mesesMin = Number(c.req.query('meses_min') ?? '0')
  const ordenar = c.req.query('ordenar') ?? 'ids'

  // Aba "Afastados" tem fonte distinta (sem score)
  if (filter === 'afastados') {
    const afastados = await getAfastadosFull(c.env)
    return c.json({
      total: afastados.length,
      filter,
      data: afastados,
    }, 200, {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600',
    })
  }

  const scores = await getLatestRanking(c.env)
  let result = applyFilterPreset(scores, filter)

  if (status) result = result.filter((s) => s.status === status)
  if (partido) result = result.filter((s) => s.partido === partido.toUpperCase())
  if (uf) result = result.filter((s) => s.uf === uf.toUpperCase())
  if (bloco) result = result.filter((s) => s.bloco.toLowerCase().includes(bloco.toLowerCase()))
  if (mesesMin > 0) result = result.filter((s) => (s.mesesAtivos ?? 0) >= mesesMin)

  result = ordenarScores(result, ordenar)

  return c.json({
    total: result.length,
    filter,
    ordenar,
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
  const statuses = [...new Set(scores.map((s) => s.status).filter(Boolean))].sort() as string[]
  return c.json({
    partidos, ufs, blocos, statuses,
    filtros: ['geral', 'ativos', 'titulares', 'suplentes', 'recentes', 'afastados'],
    ordenacao: ['ids', 'ids_bruto', 'nome', 'partido', 'uf', 'meses'],
  }, 200, {
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
