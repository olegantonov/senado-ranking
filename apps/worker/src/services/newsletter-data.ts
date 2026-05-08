/**
 * Coleta deltas semanais para a newsletter:
 *  - Top 10 atual + comparação com snapshot anterior
 *  - Top movers (subiram/desceram >= 5 posições)
 *  - Atividade legislativa da semana (autorias, votações)
 *  - Movimentações (afastados / retornados / suplentes assumindo)
 *  - Agenda de plenário e comissões da próxima semana
 *
 * Saída: NewsletterData estruturado para alimentar o prompt da IA.
 */

import type { Env, IdsScore } from '../types'
import { getLatestRanking } from './ranking'
import { getSenadorList, getAfastadosFull } from './legis'

export interface NewsletterTopItem {
  posicao: number
  posicaoAnterior?: number
  delta?: number
  senadorCod: string
  nome: string
  partido: string
  uf: string
  status?: string
  idsTotal: number
  idsAnterior?: number
  deltaIds?: number
  destaque?: string
}

export interface NewsletterMovimentacao {
  tipo: 'entrou' | 'saiu' | 'afastou'
  nome: string
  partido?: string
  uf?: string
  motivo?: string
  data?: string
}

export interface NewsletterAtividade {
  totalProcessosNovos: number
  totalVotacoes: number
  totalDiscursos: number
  topAutores?: Array<{ nome: string; partido: string; uf: string; quantidade: number }>
}

export interface NewsletterAgendaItem {
  dataHora: string
  titulo: string
  local: string
  tipo: string
}

export interface NewsletterData {
  edicao: string                       // ex: "2026-W19"
  semana: { inicio: string; fim: string }
  semanaAnterior: { inicio: string; fim: string }
  totalSenadores: number
  panorama: {
    idsMedio: number
    idsMaior: number
    idsMenor: number
    confiancaAlta: number
    confiancaBaixa: number
  }
  topAtual: NewsletterTopItem[]
  bottomAtual: NewsletterTopItem[]
  topMovers: NewsletterTopItem[]       // mudanças relevantes (>= 5 posições ou >= 10% IDS)
  movimentacoes: NewsletterMovimentacao[]
  atividade: NewsletterAtividade
  agenda: NewsletterAgendaItem[]
  fontes: string[]
  geradoEm: string
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function rangeSemana(now = new Date()): { inicio: string; fim: string } {
  // Semana ISO: segunda → domingo. Para a edição que sai segunda 09:00 BRT, a
  // "semana referência" é a anterior fechada (segunda 7d atrás → domingo 1d atrás).
  const dia = now.getUTCDay() || 7  // 1..7 (segunda=1)
  const fimSemanaAnterior = new Date(now)
  fimSemanaAnterior.setUTCDate(now.getUTCDate() - dia)  // domingo
  const inicio = new Date(fimSemanaAnterior)
  inicio.setUTCDate(fimSemanaAnterior.getUTCDate() - 6)  // segunda
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fimSemanaAnterior.toISOString().slice(0, 10),
  }
}

function shiftSemana(s: { inicio: string; fim: string }): { inicio: string; fim: string } {
  const [yi, mi, di] = s.inicio.split('-').map(Number)
  const [yf, mf, df] = s.fim.split('-').map(Number)
  const i = new Date(Date.UTC(yi, mi - 1, di - 7))
  const f = new Date(Date.UTC(yf, mf - 1, df - 7))
  return {
    inicio: i.toISOString().slice(0, 10),
    fim: f.toISOString().slice(0, 10),
  }
}

async function snapshotEm(env: Env, dataLimite: string): Promise<IdsScore[]> {
  const row = await env.SENADO_DB.prepare(
    `SELECT MAX(computed_at) as ts FROM ranking_snapshots WHERE computed_at <= ?`,
  ).bind(dataLimite + 'T23:59:59Z').first<{ ts: string }>()
  if (!row?.ts) return []
  const result = await env.SENADO_DB.prepare(
    `SELECT * FROM ranking_snapshots WHERE computed_at = ? ORDER BY ids_total DESC`,
  ).bind(row.ts).all<Record<string, unknown>>()
  return (result.results ?? []).map((r) => ({
    senadorCod: String(r.senador_cod),
    nome: String(r.nome),
    partido: String(r.partido ?? ''),
    uf: String(r.uf ?? ''),
    bloco: String(r.bloco ?? ''),
    fotoUrl: String(r.foto_url ?? ''),
    idsTotal: Number(r.ids_total),
    dimProdutividade: Number(r.dim_produtividade),
    dimEfetividade: Number(r.dim_efetividade),
    dimParticipacao: Number(r.dim_participacao),
    dimFiscalizacao: Number(r.dim_fiscalizacao),
    dimCeap: Number(r.dim_ceap),
    dimTransparencia: Number(r.dim_transparencia),
    autoriasTotal: Number(r.autorias_total ?? 0),
    autoriasAprovadas: Number(r.autorias_aprovadas ?? 0),
    votacaoPresentes: Number(r.votacoes_presentes ?? 0),
    votacoesTotal: Number(r.votacoes_total ?? 0),
    relatoriasTotal: Number(r.relatorias_total ?? 0),
    discursosTotal: Number(r.discursos_total ?? 0),
    apartesTotal: Number(r.apartes_total ?? 0),
    ceapTotalAno: Number(r.ceap_total_ano ?? 0),
    mesesAtivos: Number(r.meses_ativos ?? 0),
    status: (r.status ?? undefined) as IdsScore['status'],
    confianca: (r.confianca ?? undefined) as IdsScore['confianca'],
  }))
}

async function fetchAtividadeSemanal(
  env: Env,
  inicio: string,
  fim: string,
): Promise<NewsletterAtividade> {
  // /processo aceita data de apresentação; usamos para contar matérias novas.
  const urlProc = `${env.LEGIS_BASE_URL}/processo?dataInicioApresentacao=${inicio}&dataFimApresentacao=${fim}`
  const urlVot = `${env.LEGIS_BASE_URL}/votacao?dataInicio=${inicio}&dataFim=${fim}`

  const fetchJson = async (url: string): Promise<unknown[]> => {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
      if (!res.ok) return []
      const j = (await res.json()) as unknown
      return Array.isArray(j) ? j : []
    } catch {
      return []
    }
  }

  const [processos, votacoes] = await Promise.all([fetchJson(urlProc), fetchJson(urlVot)])

  // Top autores na semana (estima por contagem em "autoria" string — heurística)
  const autorCount = new Map<string, number>()
  for (const p of processos) {
    const obj = p as Record<string, unknown>
    const a = String(obj.autoria ?? '')
    const matches = a.match(/Senador[a]?\s+([^(]+)\s*\([A-Z]+\/[A-Z]{2}\)/g) ?? []
    for (const m of matches) {
      const trimmed = m.trim()
      autorCount.set(trimmed, (autorCount.get(trimmed) ?? 0) + 1)
    }
  }
  const topAutores = [...autorCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([raw, quantidade]) => {
      const m = raw.match(/Senador[a]?\s+([^(]+)\(([A-Z]+)\/([A-Z]{2})\)/)
      return {
        nome: (m?.[1] ?? raw).trim(),
        partido: m?.[2] ?? '',
        uf: m?.[3] ?? '',
        quantidade,
      }
    })

  // Discursos da semana (fonte global é cara — pulamos por enquanto)
  return {
    totalProcessosNovos: processos.length,
    totalVotacoes: votacoes.length,
    totalDiscursos: 0,
    topAutores,
  }
}

async function fetchAgenda(env: Env): Promise<NewsletterAgendaItem[]> {
  const url = `${env.LEGIS_BASE_URL}/plenario/agenda/atual/iCal`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return []
    const ics = await res.text()
    return parseICalAgenda(ics).slice(0, 8)
  } catch {
    return []
  }
}

function parseICalAgenda(ics: string): NewsletterAgendaItem[] {
  const events: NewsletterAgendaItem[] = []
  const blocks = ics.split('BEGIN:VEVENT').slice(1)
  for (const b of blocks) {
    const get = (k: string) => {
      const m = b.match(new RegExp(`${k}[^:]*:([^\\r\\n]+)`))
      return m ? m[1].trim() : ''
    }
    const dtstart = get('DTSTART')
    const summary = get('SUMMARY').replace(/\\n/g, ' ').replace(/\\,/g, ',')
    const location = get('LOCATION')
    if (!dtstart || !summary) continue
    const dataHora = formatIcsDate(dtstart)
    if (!dataHora) continue
    events.push({
      dataHora,
      titulo: summary,
      local: location,
      tipo: summary.toLowerCase().includes('comissão') ? 'comissão' : 'plenário',
    })
  }
  // Filtrar pra próximos 8 dias
  const hoje = new Date().toISOString().slice(0, 10)
  return events.filter((e) => e.dataHora.slice(0, 10) >= hoje).sort((a, b) => a.dataHora.localeCompare(b.dataHora))
}

function formatIcsDate(s: string): string {
  // ex: 20260512T140000Z ou 20260512
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/)
  if (!m) return ''
  const [, y, mo, d, h, mi] = m
  if (h && mi) return `${y}-${mo}-${d}T${h}:${mi}:00Z`
  return `${y}-${mo}-${d}T00:00:00Z`
}

export async function coletarDadosSemanais(env: Env): Promise<NewsletterData> {
  const now = new Date()
  const semana = rangeSemana(now)
  const semanaAnterior = shiftSemana(semana)
  const edicao = isoWeek(now)

  const [atual, anterior, lista, afastados, atividade, agenda] = await Promise.all([
    getLatestRanking(env),
    snapshotEm(env, semanaAnterior.fim),
    getSenadorList(env),
    getAfastadosFull(env),
    fetchAtividadeSemanal(env, semana.inicio, semana.fim),
    fetchAgenda(env),
  ])

  const posAnteriorMap = new Map<string, { pos: number; ids: number }>()
  anterior.forEach((s, i) => posAnteriorMap.set(s.senadorCod, { pos: i + 1, ids: s.idsTotal }))

  const enriched: NewsletterTopItem[] = atual.map((s, i) => {
    const prev = posAnteriorMap.get(s.senadorCod)
    return {
      posicao: i + 1,
      posicaoAnterior: prev?.pos,
      delta: prev ? prev.pos - (i + 1) : undefined,  // delta>0 = subiu
      senadorCod: s.senadorCod,
      nome: s.nome,
      partido: s.partido,
      uf: s.uf,
      status: s.status,
      idsTotal: s.idsTotal,
      idsAnterior: prev?.ids,
      deltaIds: prev ? Math.round((s.idsTotal - prev.ids) * 10) / 10 : undefined,
    }
  })

  const topAtual = enriched.slice(0, 10)
  const bottomAtual = enriched.slice(-5).reverse()

  const topMovers = enriched
    .filter((e) => e.delta !== undefined && (Math.abs(e.delta) >= 5 || (e.deltaIds !== undefined && Math.abs(e.deltaIds) >= 5)))
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, 6)

  // Movimentações: comparar lista atual com snapshot da semana anterior
  const codsAtuais = new Set(lista.map((s) => s.codigo))
  const codsAnteriores = new Set(anterior.map((s) => s.senadorCod))
  const movimentacoes: NewsletterMovimentacao[] = []
  for (const s of lista) {
    if (!codsAnteriores.has(s.codigo)) {
      movimentacoes.push({ tipo: 'entrou', nome: s.nome, partido: s.partido, uf: s.uf })
    }
  }
  for (const a of anterior) {
    if (!codsAtuais.has(a.senadorCod)) {
      const af = afastados.find((x) => x.codigo === a.senadorCod)
      movimentacoes.push({
        tipo: af ? 'afastou' : 'saiu',
        nome: a.nome,
        partido: a.partido,
        uf: a.uf,
        motivo: af?.motivo,
        data: af?.dataInicio,
      })
    }
  }

  // Panorama
  const idsValores = atual.map((s) => s.idsTotal)
  const panorama = {
    idsMedio: Math.round((idsValores.reduce((a, b) => a + b, 0) / Math.max(idsValores.length, 1)) * 10) / 10,
    idsMaior: idsValores.length ? Math.round(Math.max(...idsValores) * 10) / 10 : 0,
    idsMenor: idsValores.length ? Math.round(Math.min(...idsValores) * 10) / 10 : 0,
    confiancaAlta: atual.filter((s) => s.confianca === 'alta').length,
    confiancaBaixa: atual.filter((s) => s.confianca === 'baixa').length,
  }

  return {
    edicao,
    semana,
    semanaAnterior,
    totalSenadores: atual.length,
    panorama,
    topAtual,
    bottomAtual,
    topMovers,
    movimentacoes: movimentacoes.slice(0, 10),
    atividade,
    agenda,
    fontes: [
      'https://legis.senado.leg.br/dadosabertos/processo',
      'https://legis.senado.leg.br/dadosabertos/votacao',
      'https://legis.senado.leg.br/dadosabertos/plenario/agenda/atual/iCal',
      'https://observasenado.org',
    ],
    geradoEm: now.toISOString(),
  }
}
