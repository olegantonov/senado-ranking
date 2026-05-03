import { Hono } from 'hono'
import type { Env } from '../types'
import { getCeapMensal } from '../services/adm'

const ceap = new Hono<{ Bindings: Env }>()

ceap.get('/:codigo', async (c) => {
  const codigo = c.req.param('codigo')
  const anoParam = c.req.query('ano')
  const ano = anoParam ? parseInt(anoParam, 10) : new Date().getFullYear()

  if (isNaN(ano) || ano < 2000 || ano > 2099) {
    return c.json({ error: 'Ano inválido' }, 400)
  }

  const meses = await getCeapMensal(c.env, codigo, ano)

  return c.json(
    { codigo, ano, meses },
    200,
    { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
  )
})

export { ceap }
