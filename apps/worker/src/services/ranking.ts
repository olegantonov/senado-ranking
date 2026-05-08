import type { Env, IdsScore, RawDimensions, Senador } from '../types'
import { getSenadorList, getRawDimensions, mesesAtivos } from './legis'
import {
  getCeapLeg57,
  getCeapBreakdownLeg57,
  getEscritoriosCount,
  getAuxiliosMoradia,
  normalizeNome,
} from './adm'

// ─────────────────────────────────────────────────────────────────────────────
// IDS v2.2 — Fase 2 (votações em comissão + CEAP multidimensional)
// ─────────────────────────────────────────────────────────────────────────────
// Mudanças v2.1 → v2.2:
//   - Participação: 60% plenário + 40% comissão
//   - CEAP: penalidade pelo % gasto em "divulgação" (autopromoção)
//   - Breakdown CEAP por tipo no retorno (informativo)
//   - Pesos mantidos da Fase 1
export const WEIGHTS = {
  produtividade: 0.20,
  efetividade: 0.24,
  participacao: 0.20,
  fiscalizacao: 0.13,
  ceap: 0.11,
  transparencia: 0.12,
}

// Sanity-check no startup do módulo
const _sumW = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
if (Math.abs(_sumW - 1) > 0.001) {
  console.warn(`[ranking] WEIGHTS soma ${_sumW}, esperado 1.0`)
}

/**
 * IDS v3: shrinkage Bayesiano para amostras pequenas (mandatos curtos).
 *
 * Cada dimensão é uma taxa: numerador / mesesAtivos. Para parlamentares com
 * poucos meses, essa taxa é instável (1 autoria em 1 mês = 1.0/mês, ranking
 * artificialmente alto). Aplicamos a fórmula:
 *
 *     taxa_ajustada = (numerador + media_taxa × K) / (mesesAtivos + K)
 *
 * onde K = 12 meses (1 ano legislativo). Quem tem ≥30m fica quase idêntico
 * ao bruto; quem tem 1m fica praticamente na média do grupo. Casos extremos
 * (Camilo Santana 1m com 1 autoria, Renan Filho voltado de ministro) são
 * neutralizados sem desaparecer do ranking.
 *
 * Valor calibrado por simulação em 80 senadores; ver scripts/simulate_k.py.
 */
const SHRINKAGE_K = 12

function shrinkRate(
  numerador: number,
  meses: number,
  mediaTaxa: number,
): number {
  return (numerador + mediaTaxa * SHRINKAGE_K) / (meses + SHRINKAGE_K)
}

function shrinkRatio(num: number, den: number, mediaRatio: number): number {
  return (num + mediaRatio * SHRINKAGE_K) / (den + SHRINKAGE_K)
}

/**
 * Normaliza valores brutos em scores 0-100 via z-score → percentil normal.
 *
 * Se mais de 50% dos valores forem idênticos (típico de cascata de fetches
 * falhos), retorna tudo zero para que o dashboard falhe visivelmente em
 * vez de produzir percentis fabricados a partir de input degenerado.
 */
function zscorePercentil(values: number[], label = ''): number[] {
  const n = values.length
  if (n === 0) return []

  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const modeCount = Math.max(...counts.values())
  if (modeCount / n > 0.5) {
    console.warn(
      `[ranking] distribuição degenerada em ${label || '?'}: ` +
        `${modeCount}/${n} valores idênticos — retornando zeros`,
    )
    return values.map(() => 0)
  }

  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const std = Math.sqrt(variance) || 1

  return values.map((v) => {
    const z = (v - mean) / std
    const p = 0.5 * (1 + erf(z / Math.SQRT2))
    return Math.round(Math.min(100, Math.max(0, p * 100)))
  })
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

export async function computeRanking(env: Env): Promise<IdsScore[]> {
  // 1. Lista de senadores em exercício (com data de início efetivo)
  const senadores: Senador[] = await getSenadorList(env)
  console.log(`[ranking] ${senadores.length} senadores encontrados`)

  // 2. CEAP acumulado da legislatura inteira (total e breakdown por tipo)
  const ceapLeg57 = await getCeapLeg57(env)
  const ceapBreakdown = await getCeapBreakdownLeg57(env)
  const escritoriosByName = await getEscritoriosCount(env)

  // 3. Auxílio moradia (snapshot atual)
  const auxiliosMoradia = await getAuxiliosMoradia(env)

  // 4. Dimensões brutas — PRIMEIRO tenta KV consolidado (raw:v2:<cod>),
  //    só cai pra fetch direto se faltar (custa < 100 subreqs no caminho feliz)
  const rawMap: Record<string, RawDimensions> = {}
  const faltantes: string[] = []

  await Promise.all(
    senadores.map(async (s) => {
      const cached = await env.SENADO_CACHE.get(`raw:v2:${s.codigo}`, 'json')
      if (cached !== null) {
        rawMap[s.codigo] = {
          ...(cached as RawDimensions),
          ceapTotalAno: ceapLeg57[s.codigo] ?? 0,
        }
      } else {
        faltantes.push(s.codigo)
      }
    }),
  )

  if (faltantes.length > 0) {
    console.warn(
      `[ranking] ${faltantes.length} senadores sem cache raw:v2 — buscando agora`,
    )
    const BATCH = 5
    for (let i = 0; i < faltantes.length; i += BATCH) {
      const slice = faltantes.slice(i, i + BATCH)
      const results = await Promise.allSettled(
        slice.map((cod) => getRawDimensions(env, cod)),
      )
      for (let j = 0; j < slice.length; j++) {
        const r = results[j]
        if (r.status === 'fulfilled') {
          rawMap[slice[j]] = {
            ...r.value,
            ceapTotalAno: ceapLeg57[slice[j]] ?? 0,
          }
          // Persiste no KV p/ próximas execuções (cron semanal não precisa
          // refazer fetch toda vez)
          await env.SENADO_CACHE.put(
            `raw:v2:${slice[j]}`,
            JSON.stringify(r.value),
            { expirationTtl: 8 * 24 * 60 * 60 }, // 8 dias > 1 semana
          )
        } else {
          rawMap[slice[j]] = emptyRaw(ceapLeg57[slice[j]] ?? 0)
        }
      }
    }
  }

  // Garante entry vazia se algum senador faltou
  for (const s of senadores) {
    if (!rawMap[s.codigo]) {
      rawMap[s.codigo] = emptyRaw(ceapLeg57[s.codigo] ?? 0)
    }
  }

  // 5. Vetores normalizados POR MÊS DE MANDATO
  const cods = senadores.map((s) => s.codigo)
  const mesesPorSen = senadores.map(
    (s) => s.mesesAtivos ?? mesesAtivos(s.dataInicioExercicio ?? '2023-02-01'),
  )

  // Taxas BRUTAS (sem shrinkage) — usadas para calcular médias do grupo e
  // também para registrar idsTotalBruto (transparência).
  const rawTaxa = {
    produtividade: cods.map(
      (c, i) => (rawMap[c]?.produtividadePonderada ?? 0) / mesesPorSen[i],
    ),
    efetividade: cods.map((c) => {
      const r = rawMap[c]
      return r && r.efetividadeBase > 0
        ? r.efetividadePonderada / r.efetividadeBase
        : 0
    }),
    participacao: cods.map((c) => {
      const r = rawMap[c]
      if (!r) return 0
      const plen =
        r.votacoesTotal > 0 ? r.votacoesPresentes / r.votacoesTotal : 0
      const com =
        (r.votacoesComissaoTotal ?? 0) > 0
          ? (r.votacoesComissaoPresentes ?? 0) /
            (r.votacoesComissaoTotal ?? 1)
          : plen
      return 0.6 * plen + 0.4 * com
    }),
    fiscalizacao: cods.map((c, i) => {
      const r = rawMap[c]
      if (!r) return 0
      const base = r.relatoriasTotal / mesesPorSen[i]
      const ajuste = 1 / (1 + 0.3 * r.cargosLideranca)
      return base * ajuste
    }),
    ceap: cods.map((c, i) => {
      const total = (rawMap[c]?.ceapTotalAno ?? 0) / mesesPorSen[i]
      const bd = ceapBreakdown[c]
      const pctDivulg = bd && bd.total > 0 ? bd.divulgacao / bd.total : 0
      const fatorDivulg = 1 - 0.6 * pctDivulg
      return -total / Math.max(fatorDivulg, 0.4)
    }),
    transparencia: cods.map((c, i) => {
      const r = rawMap[c]
      if (!r) return 0
      return (r.discursosTotal + 0.5 * r.apartesTotal) / mesesPorSen[i]
    }),
  }

  // Médias do grupo por dimensão (média das taxas brutas)
  const N = cods.length || 1
  const medias = {
    produtividade: rawTaxa.produtividade.reduce((a, b) => a + b, 0) / N,
    efetividade: rawTaxa.efetividade.reduce((a, b) => a + b, 0) / N,
    participacao: rawTaxa.participacao.reduce((a, b) => a + b, 0) / N,
    fiscalizacao: rawTaxa.fiscalizacao.reduce((a, b) => a + b, 0) / N,
    ceap: rawTaxa.ceap.reduce((a, b) => a + b, 0) / N,
    transparencia: rawTaxa.transparencia.reduce((a, b) => a + b, 0) / N,
  }

  // IDS v3: aplica shrinkage por dimensão. Numerador/denominador respeitam
  // a forma matemática original (taxa por mês, ou razão de pesos para efetividade).
  const vetor = {
    produtividade: cods.map((c, i) =>
      shrinkRate(
        rawMap[c]?.produtividadePonderada ?? 0,
        mesesPorSen[i],
        medias.produtividade,
      ),
    ),
    efetividade: cods.map((c) => {
      const r = rawMap[c]
      const num = r?.efetividadePonderada ?? 0
      const den = r?.efetividadeBase ?? 0
      return shrinkRatio(num, den, medias.efetividade)
    }),
    participacao: cods.map((c, i) =>
      shrinkRate(
        rawTaxa.participacao[i] * mesesPorSen[i],
        mesesPorSen[i],
        medias.participacao,
      ),
    ),
    fiscalizacao: cods.map((c, i) => {
      const r = rawMap[c]
      const num = (r?.relatoriasTotal ?? 0) / (1 + 0.3 * (r?.cargosLideranca ?? 0))
      return shrinkRate(num, mesesPorSen[i], medias.fiscalizacao)
    }),
    ceap: cods.map((c, i) => {
      const r = rawMap[c]
      const bd = ceapBreakdown[c]
      const pctDivulg = bd && bd.total > 0 ? bd.divulgacao / bd.total : 0
      const fatorDivulg = Math.max(1 - 0.6 * pctDivulg, 0.4)
      const num = -(r?.ceapTotalAno ?? 0) / fatorDivulg
      return shrinkRate(num, mesesPorSen[i], medias.ceap)
    }),
    transparencia: cods.map((c, i) => {
      const r = rawMap[c]
      const num = (r?.discursosTotal ?? 0) + 0.5 * (r?.apartesTotal ?? 0)
      return shrinkRate(num, mesesPorSen[i], medias.transparencia)
    }),
  }

  const norm = {
    produtividade: zscorePercentil(vetor.produtividade, 'produtividade'),
    efetividade: zscorePercentil(vetor.efetividade, 'efetividade'),
    participacao: zscorePercentil(vetor.participacao, 'participacao'),
    fiscalizacao: zscorePercentil(vetor.fiscalizacao, 'fiscalizacao'),
    ceap: zscorePercentil(vetor.ceap, 'ceap'),
    transparencia: zscorePercentil(vetor.transparencia, 'transparencia'),
  }

  // Versão BRUTA das dimensões (sem shrinkage), só para registrar idsTotalBruto.
  // Não vai pro ranking principal; é exibida no detalhe de cada senador.
  const normBruto = {
    produtividade: zscorePercentil(rawTaxa.produtividade, 'produtividade_bruto'),
    efetividade: zscorePercentil(rawTaxa.efetividade, 'efetividade_bruto'),
    participacao: zscorePercentil(rawTaxa.participacao, 'participacao_bruto'),
    fiscalizacao: zscorePercentil(rawTaxa.fiscalizacao, 'fiscalizacao_bruto'),
    ceap: zscorePercentil(rawTaxa.ceap, 'ceap_bruto'),
    transparencia: zscorePercentil(rawTaxa.transparencia, 'transparencia_bruto'),
  }

  // 6. Compõe IDS final
  return senadores
    .map((s, i) => {
      const idsTotal =
        norm.produtividade[i] * WEIGHTS.produtividade +
        norm.efetividade[i] * WEIGHTS.efetividade +
        norm.participacao[i] * WEIGHTS.participacao +
        norm.fiscalizacao[i] * WEIGHTS.fiscalizacao +
        norm.ceap[i] * WEIGHTS.ceap +
        norm.transparencia[i] * WEIGHTS.transparencia

      const idsTotalBruto =
        normBruto.produtividade[i] * WEIGHTS.produtividade +
        normBruto.efetividade[i] * WEIGHTS.efetividade +
        normBruto.participacao[i] * WEIGHTS.participacao +
        normBruto.fiscalizacao[i] * WEIGHTS.fiscalizacao +
        normBruto.ceap[i] * WEIGHTS.ceap +
        normBruto.transparencia[i] * WEIGHTS.transparencia

      const r = rawMap[s.codigo]
      const aux = auxiliosMoradia[normalizeNome(s.nome)] ?? {
        auxilioMoradia: false,
        imovelFuncional: false,
      }
      const bd = ceapBreakdown[s.codigo]
      const escCount = escritoriosByName[normalizeNome(s.nome)] ?? 0
      const pctDiv = bd && bd.total > 0 ? bd.divulgacao / bd.total : 0

      return {
        senadorCod: s.codigo,
        nome: s.nome,
        partido: s.partido,
        uf: s.uf,
        bloco: s.bloco,
        fotoUrl: s.fotoUrl,
        dataInicioExercicio: s.dataInicioExercicio ?? '2023-02-01',
        mesesAtivos: mesesPorSen[i],
        idsTotal: Math.round(idsTotal * 10) / 10,
        dimProdutividade: norm.produtividade[i],
        dimEfetividade: norm.efetividade[i],
        dimParticipacao: norm.participacao[i],
        dimFiscalizacao: norm.fiscalizacao[i],
        dimCeap: norm.ceap[i],
        dimTransparencia: norm.transparencia[i],
        autoriasTotal: r?.autoriasTotal ?? 0,
        autoriasAprovadas: r?.autoriasAprovadas ?? 0,
        votacaoPresentes: r?.votacoesPresentes ?? 0,
        votacoesTotal: r?.votacoesTotal ?? 0,
        votacoesComissaoPresentes: r?.votacoesComissaoPresentes ?? 0,
        votacoesComissaoTotal: r?.votacoesComissaoTotal ?? 0,
        relatoriasTotal: r?.relatoriasTotal ?? 0,
        discursosTotal: r?.discursosTotal ?? 0,
        apartesTotal: r?.apartesTotal ?? 0,
        ceapTotalAno: r?.ceapTotalAno ?? 0,
        ceapDivulgacao: bd?.divulgacao ?? 0,
        ceapEscritorio: bd?.escritorio ?? 0,
        ceapLocomocao: bd?.locomocao ?? 0,
        ceapConsultoria: bd?.consultoria ?? 0,
        ceapOutros: bd?.outros ?? 0,
        pctDivulgacao: Math.round(pctDiv * 1000) / 10,
        escritoriosCount: escCount,
        cargosLideranca: r?.cargosLideranca ?? 0,
        cargosTitulos: r?.cargosTitulos ?? [],
        auxilioMoradia: aux.auxilioMoradia,
        imovelFuncional: aux.imovelFuncional,
        status: s.status,
        confianca: s.confianca,
        idsTotalBruto: Math.round(idsTotalBruto * 10) / 10,
      }
    })
    .sort((a, b) => b.idsTotal - a.idsTotal)
}

function emptyRaw(ceap: number): RawDimensions {
  return {
    autoriasTotal: 0,
    autoriasAprovadas: 0,
    produtividadePonderada: 0,
    efetividadePonderada: 0,
    efetividadeBase: 0,
    votacoesPresentes: 0,
    votacoesTotal: 1,
    votacoesComissaoPresentes: 0,
    votacoesComissaoTotal: 0,
    relatoriasTotal: 0,
    discursosTotal: 0,
    apartesTotal: 0,
    cargosLideranca: 0,
    cargosTitulos: [],
    ceapTotalAno: ceap,
  }
}

export async function persistRanking(
  env: Env,
  scores: IdsScore[],
): Promise<void> {
  const computedAt = new Date().toISOString()

  const stmt = env.SENADO_DB.prepare(
    `INSERT INTO ranking_snapshots
     (computed_at, senador_cod, nome, partido, uf, bloco, foto_url,
      data_inicio_exercicio, meses_ativos, auxilio_moradia, imovel_funcional,
      ids_total, dim_produtividade, dim_efetividade, dim_participacao,
      dim_fiscalizacao, dim_ceap, dim_transparencia,
      autorias_total, autorias_aprovadas, votacoes_presentes, votacoes_total,
      votacoes_comissao_presentes, votacoes_comissao_total,
      relatorias_total, discursos_total, apartes_total,
      cargos_lideranca, cargos_titulos,
      ceap_total_ano, ceap_divulgacao, ceap_escritorio, ceap_locomocao,
      ceap_consultoria, ceap_outros, pct_divulgacao, escritorios_count,
      status, confianca, ids_total_bruto)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const BATCH = 50
  for (let i = 0; i < scores.length; i += BATCH) {
    const batch = scores.slice(i, i + BATCH)
    await env.SENADO_DB.batch(
      batch.map((s) =>
        stmt.bind(
          computedAt,
          s.senadorCod, s.nome, s.partido, s.uf, s.bloco, s.fotoUrl ?? '',
          s.dataInicioExercicio ?? '2023-02-01',
          s.mesesAtivos ?? 0,
          s.auxilioMoradia ? 1 : 0,
          s.imovelFuncional ? 1 : 0,
          s.idsTotal, s.dimProdutividade, s.dimEfetividade, s.dimParticipacao,
          s.dimFiscalizacao, s.dimCeap, s.dimTransparencia,
          s.autoriasTotal, s.autoriasAprovadas, s.votacaoPresentes, s.votacoesTotal,
          s.votacoesComissaoPresentes ?? 0, s.votacoesComissaoTotal ?? 0,
          s.relatoriasTotal, s.discursosTotal, s.apartesTotal,
          s.cargosLideranca ?? 0,
          JSON.stringify(s.cargosTitulos ?? []),
          s.ceapTotalAno,
          s.ceapDivulgacao ?? 0, s.ceapEscritorio ?? 0,
          s.ceapLocomocao ?? 0, s.ceapConsultoria ?? 0,
          s.ceapOutros ?? 0, s.pctDivulgacao ?? 0,
          s.escritoriosCount ?? 0,
          s.status ?? null, s.confianca ?? null, s.idsTotalBruto ?? null,
        ),
      ),
    )
  }
  console.log(`[ranking] ${scores.length} scores persistidos em ${computedAt}`)

  // Keep only the 30 most recent snapshots to prevent unbounded table growth
  await env.SENADO_DB.prepare(
    `DELETE FROM ranking_snapshots WHERE computed_at NOT IN (
      SELECT DISTINCT computed_at FROM ranking_snapshots ORDER BY computed_at DESC LIMIT 30
    )`,
  ).run()
}

export async function getLatestRanking(env: Env): Promise<IdsScore[]> {
  const latestDate = await env.SENADO_DB.prepare(
    `SELECT MAX(computed_at) as ts FROM ranking_snapshots`,
  ).first<{ ts: string }>()

  if (!latestDate?.ts) return []

  const rows = await env.SENADO_DB.prepare(
    `SELECT * FROM ranking_snapshots WHERE computed_at = ? ORDER BY ids_total DESC`,
  )
    .bind(latestDate.ts)
    .all<Record<string, unknown>>()

  return (rows.results ?? []).map((r) => {
    let cargosTitulos: string[] = []
    try {
      cargosTitulos = JSON.parse(String(r.cargos_titulos ?? '[]'))
    } catch {
      cargosTitulos = []
    }

    return {
      senadorCod: String(r.senador_cod),
      nome: String(r.nome),
      partido: String(r.partido ?? ''),
      uf: String(r.uf ?? ''),
      bloco: String(r.bloco ?? ''),
      fotoUrl: String(r.foto_url ?? ''),
      dataInicioExercicio: String(r.data_inicio_exercicio ?? '2023-02-01'),
      mesesAtivos: Number(r.meses_ativos ?? 0),
      auxilioMoradia: Boolean(r.auxilio_moradia),
      imovelFuncional: Boolean(r.imovel_funcional),
      idsTotal: Number(r.ids_total),
      dimProdutividade: Number(r.dim_produtividade),
      dimEfetividade: Number(r.dim_efetividade),
      dimParticipacao: Number(r.dim_participacao),
      dimFiscalizacao: Number(r.dim_fiscalizacao),
      dimCeap: Number(r.dim_ceap),
      dimTransparencia: Number(r.dim_transparencia),
      autoriasTotal: Number(r.autorias_total),
      autoriasAprovadas: Number(r.autorias_aprovadas),
      votacaoPresentes: Number(r.votacoes_presentes),
      votacoesTotal: Number(r.votacoes_total),
      relatoriasTotal: Number(r.relatorias_total),
      discursosTotal: Number(r.discursos_total),
      apartesTotal: Number(r.apartes_total ?? 0),
      votacoesComissaoPresentes: Number(r.votacoes_comissao_presentes ?? 0),
      votacoesComissaoTotal: Number(r.votacoes_comissao_total ?? 0),
      ceapTotalAno: Number(r.ceap_total_ano),
      ceapDivulgacao: Number(r.ceap_divulgacao ?? 0),
      ceapEscritorio: Number(r.ceap_escritorio ?? 0),
      ceapLocomocao: Number(r.ceap_locomocao ?? 0),
      ceapConsultoria: Number(r.ceap_consultoria ?? 0),
      ceapOutros: Number(r.ceap_outros ?? 0),
      pctDivulgacao: Number(r.pct_divulgacao ?? 0),
      escritoriosCount: Number(r.escritorios_count ?? 0),
      cargosLideranca: Number(r.cargos_lideranca ?? 0),
      cargosTitulos,
      status: (r.status ?? undefined) as IdsScore['status'],
      confianca: (r.confianca ?? undefined) as IdsScore['confianca'],
      idsTotalBruto: r.ids_total_bruto != null ? Number(r.ids_total_bruto) : undefined,
    }
  })
}
