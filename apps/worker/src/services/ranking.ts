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
 * Normaliza valores brutos em scores 0-100 via z-score → percentil normal.
 */
function zscorePercentil(values: number[]): number[] {
  const n = values.length
  if (n === 0) return []
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
        rawMap[slice[j]] =
          r.status === 'fulfilled'
            ? { ...r.value, ceapTotalAno: ceapLeg57[slice[j]] ?? 0 }
            : emptyRaw(ceapLeg57[slice[j]] ?? 0)
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
  const mesesPorSen = senadores.map((s) =>
    mesesAtivos(s.dataInicioExercicio ?? '2023-02-01'),
  )

  const vetor = {
    // Produtividade v2: PONTOS PONDERADOS por tipo / mês ativo
    // PEC × 3, PLP × 2, PL × 1.5, MPV × 1, RQS × 0.4, IND × 0.2
    produtividade: cods.map(
      (c, i) => (rawMap[c]?.produtividadePonderada ?? 0) / mesesPorSen[i],
    ),

    // Efetividade v2: razão (efetividadePonderada / efetividadeBase)
    // Numerador soma status × peso_tipo; denominador soma peso_tipo
    // Resultado teórico ∈ [0, 3]: 3 = todas viraram lei, 0 = nada aprovado
    efetividade: cods.map((c) => {
      const r = rawMap[c]
      return r && r.efetividadeBase > 0
        ? r.efetividadePonderada / r.efetividadeBase
        : 0
    }),

    // Participação v2: 60% plenário + 40% comissão
    participacao: cods.map((c) => {
      const r = rawMap[c]
      if (!r) return 0
      const plen =
        r.votacoesTotal > 0 ? r.votacoesPresentes / r.votacoesTotal : 0
      const com =
        (r.votacoesComissaoTotal ?? 0) > 0
          ? (r.votacoesComissaoPresentes ?? 0) /
            (r.votacoesComissaoTotal ?? 1)
          : plen // fallback p/ quem não tem voto em comissão
      return 0.6 * plen + 0.4 * com
    }),

    // Fiscalização v2: relatorias/mês COM AJUSTE POR LIDERANÇA
    // ajuste = 1 / (1 + 0.3 × cargos_liderança)
    // Presidente de comissão = 1 cargo → score multiplicado por 0.77
    fiscalizacao: cods.map((c, i) => {
      const r = rawMap[c]
      if (!r) return 0
      const base = r.relatoriasTotal / mesesPorSen[i]
      const ajuste = 1 / (1 + 0.3 * r.cargosLideranca)
      return base * ajuste
    }),

    // CEAP v2 (multidim): valor mensal invertido + penalidade autopromoção
    // Penalidade: % de despesas em "divulgação da atividade parlamentar"
    // Quanto maior o % gasto em divulgação, menor o score (mais autopromocional)
    ceap: cods.map((c, i) => {
      const total = (rawMap[c]?.ceapTotalAno ?? 0) / mesesPorSen[i]
      const bd = ceapBreakdown[c]
      const pctDivulg =
        bd && bd.total > 0 ? bd.divulgacao / bd.total : 0
      // base invertida + multiplicador de moderação em divulgação
      // pctDivulg=0 → fator 1.0; pctDivulg=0.5 → fator 0.7; pctDivulg=1 → fator 0.4
      const fatorDivulg = 1 - 0.6 * pctDivulg
      return -total / Math.max(fatorDivulg, 0.4)
    }),

    // Transparência v2: discursos + 0.5 × apartes / mês
    transparencia: cods.map((c, i) => {
      const r = rawMap[c]
      if (!r) return 0
      return (r.discursosTotal + 0.5 * r.apartesTotal) / mesesPorSen[i]
    }),
  }

  const norm = {
    produtividade: zscorePercentil(vetor.produtividade),
    efetividade: zscorePercentil(vetor.efetividade),
    participacao: zscorePercentil(vetor.participacao),
    fiscalizacao: zscorePercentil(vetor.fiscalizacao),
    ceap: zscorePercentil(vetor.ceap),
    transparencia: zscorePercentil(vetor.transparencia),
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
      ceap_consultoria, ceap_outros, pct_divulgacao, escritorios_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ),
      ),
    )
  }
  console.log(`[ranking] ${scores.length} scores persistidos em ${computedAt}`)
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
    }
  })
}
