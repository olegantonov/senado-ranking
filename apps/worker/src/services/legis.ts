import type { Env, Senador, RawDimensions } from '../types'

const CACHE_TTL_SECONDS = 6 * 60 * 60 // 6h

// Legislatura 57 — 01/02/2023 a 31/01/2027
const LEG57_INICIO = '2023-02-01'
// Anos a iterar para CEAP/discursos (somar todos)
const LEG57_ANOS = [2023, 2024, 2025, 2026]

// Pesos por tipo de proposição (IDS v2 — Produtividade Legislativa)
// Fonte da escala: complexidade típica do trâmite + impacto normativo
const PESO_PROPOSICAO: Record<string, number> = {
  PEC: 3.0,    // Proposta de Emenda à Constituição
  PLP: 2.0,    // Projeto de Lei Complementar
  PL: 1.5,     // Projeto de Lei Ordinário
  PLN: 1.5,    // Projeto de Lei do Congresso Nacional
  PLS: 1.5,    // (legado) Projeto de Lei do Senado
  PDL: 1.2,    // Projeto de Decreto Legislativo
  PDS: 1.2,    // Projeto de Decreto do Senado
  PRS: 1.0,    // Projeto de Resolução do Senado
  MPV: 1.0,    // Apreciação de Medida Provisória
  RQS: 0.4,    // Requerimento
  RQN: 0.4,    // Requerimento (numerado)
  REQ: 0.4,    // Requerimento (genérico)
  INC: 0.2,    // Indicação
  IND: 0.2,    // Indicação (legado)
  // fallback: 0.5
}

// Pesos por status final (IDS v2 — Efetividade)
const PESO_STATUS = {
  LEI: 3.0,                // Sancionada / promulgada
  APROVADO_SF: 1.5,        // Aprovado no Senado (mesmo se ainda em outra casa)
  TRAMITACAO_AVANCADA: 0.5, // Em comissão de mérito ou plenário
}

async function cachedFetch(
  env: Env,
  cacheKey: string,
  url: string,
): Promise<unknown> {
  const cached = await env.SENADO_CACHE.get(cacheKey, 'json')
  if (cached !== null) return cached

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`LEGIS fetch failed: ${url} → ${res.status}`)
  const data = await res.json()
  await env.SENADO_CACHE.put(cacheKey, JSON.stringify(data), {
    expirationTtl: CACHE_TTL_SECONDS,
  })
  return data
}

/**
 * Calcula data de início efetiva do exercício do senador na Leg 57.
 */
function getDataInicioExercicio(parlamentar: Record<string, unknown>): string {
  const mand = parlamentar?.Mandato as Record<string, unknown>
  if (!mand) return LEG57_INICIO

  const desc = String(mand?.DescricaoParticipacao ?? '')
  if (desc === 'Titular') return LEG57_INICIO

  const exercicios = mand?.Exercicios as Record<string, unknown>
  if (!exercicios) return LEG57_INICIO
  const lst = exercicios?.Exercicio
  const arr = Array.isArray(lst) ? lst : lst ? [lst] : []
  let maior = LEG57_INICIO
  for (const e of arr as Record<string, unknown>[]) {
    const dt = String(e?.DataInicio ?? '')
    if (dt > maior) maior = dt
  }
  return maior
}

export function mesesAtivos(dataInicio: string): number {
  const start = new Date(dataInicio + 'T00:00:00Z')
  const now = new Date()
  const diff =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth())
  return Math.max(diff, 1)
}

export async function getSenadorList(env: Env): Promise<Senador[]> {
  const data = (await cachedFetch(
    env,
    'legis:senadores:lista:atual',
    `${env.LEGIS_BASE_URL}/senador/lista/atual.json`,
  )) as Record<string, unknown>

  const lista =
    (
      (data?.ListaParlamentarEmExercicio as Record<string, unknown>)
        ?.Parlamentares as Record<string, unknown>
    )?.Parlamentar ?? []

  return (lista as Record<string, unknown>[])
    .map((p) => {
      const id = p?.IdentificacaoParlamentar as Record<string, unknown>
      return {
        codigo: String(id?.CodigoParlamentar ?? ''),
        nome: String(id?.NomeParlamentar ?? id?.NomeCompletoParlamentar ?? ''),
        partido: String(id?.SiglaPartidoParlamentar ?? ''),
        uf: String(id?.UfParlamentar ?? ''),
        bloco: String(
          (id?.Bloco as Record<string, unknown>)?.NomeBloco ??
            id?.SiglaPartidoParlamentar ??
            '',
        ),
        fotoUrl: String(id?.UrlFotoParlamentar ?? ''),
        email: String(id?.EmailParlamentar ?? ''),
        dataInicioExercicio: getDataInicioExercicio(p),
      }
    })
    .filter((s) => s.codigo !== '')
}

/**
 * Classifica o status de uma autoria a partir da resposta do endpoint /processo.
 * Retorna o peso da proposição (LEI/APROVADO_SF/TRAMITACAO/0) para Efetividade.
 *
 * O sinal mais confiável é `siglaTipoDeliberacao` (APROVADA_NO_PLENARIO,
 * APROVADA_EM_COMISSAO_TERMINATIVA, PREJUDICADO, RETIRADO_PELO_AUTOR, …).
 * Fallbacks usam descricaoSituacao/objetivo/tramitando para casos antigos.
 */
function classificarStatus(p: Record<string, unknown>): number {
  const delib = String(p?.siglaTipoDeliberacao ?? '').toUpperCase()
  const tram = String(p?.tramitando ?? '').toLowerCase()
  const obj = String(p?.objetivo ?? '').toLowerCase()
  const sit = String(
    (p?.identificacaoMateria as Record<string, unknown>)?.descricaoSituacao ??
      p?.descricaoSituacao ??
      p?.situacao ??
      '',
  ).toLowerCase()

  // Virou lei / promulgada / norma jurídica
  if (
    delib.includes('TRANSFORMAD') ||
    delib.includes('SANCIONAD') ||
    delib.includes('PROMULGAD') ||
    sit.includes('transformad') ||
    sit.includes('sancionad') ||
    sit.includes('promulgad') ||
    sit.includes('norma jur')
  ) {
    return PESO_STATUS.LEI
  }

  // Aprovado no Senado (plenário ou comissão terminativa)
  if (
    delib.startsWith('APROVAD') ||
    delib === 'DEFERIDO_CDIR' ||
    delib === 'APROVADO_CDIR' ||
    sit.includes('aprovad') ||
    sit.includes('remetid') ||
    obj.includes('aprovad')
  ) {
    return PESO_STATUS.APROVADO_SF
  }

  // Tramitando: vale pouco (ainda pode evoluir)
  if (tram === 'sim' || tram === 'true') {
    return PESO_STATUS.TRAMITACAO_AVANCADA
  }

  // Arquivado, prejudicado, retirado, vetado: 0
  return 0
}

/**
 * Extrai a sigla do tipo de proposição (PEC, PL, RQS, etc.) do item /processo.
 * Na listagem `/processo?codigoParlamentarAutor=...` o campo `identificacao`
 * vem no formato "PL 1678/2023" — primeira palavra é a sigla.
 */
function extrairSigla(p: Record<string, unknown>): string {
  // 1) Detalhe: campo `sigla` direto
  const direta = String(p?.sigla ?? '').toUpperCase()
  if (direta) return direta

  // 2) Listagem: parse de `identificacao` ("PL 1678/2023")
  const ident = String(p?.identificacao ?? '')
  const match = ident.match(/^([A-Z]+)\s/)
  if (match) return match[1]

  // 3) Legado
  const legacy = p?.identificacaoMateria as Record<string, unknown> | undefined
  return String(
    legacy?.siglaSubtipoMateria ??
      legacy?.siglaTipoMateria ??
      p?.siglaSubtipoMateria ??
      p?.siglaTipoMateria ??
      '',
  ).toUpperCase()
}

export async function getRawDimensions(
  env: Env,
  codigo: string,
): Promise<RawDimensions> {
  const base = env.LEGIS_BASE_URL

  // Discursos: iterar por ano (API quebra com janelas > 1 ano)
  const discursosPromises = LEG57_ANOS.map((ano) =>
    cachedFetch(
      env,
      `legis:${codigo}:discursos:${ano}`,
      `${base}/senador/${codigo}/discursos.json?dataIni=${ano}0101&dataFim=${ano}1231`,
    ).catch(() => null),
  )
  // Apartes: também por ano
  const apartesPromises = LEG57_ANOS.map((ano) =>
    cachedFetch(
      env,
      `legis:${codigo}:apartes:${ano}`,
      `${base}/senador/${codigo}/apartes.json?dataIni=${ano}0101&dataFim=${ano}1231`,
    ).catch(() => null),
  )

  const [
    relatoriasResult,
    votacoesResult,
    votacoesComissaoResult,
    liderancasResult,
    cargosResult,
    ...discursosEApartes
  ] = await Promise.allSettled([
    cachedFetch(
      env,
      `legis:${codigo}:relatorias:leg57`,
      `${base}/senador/${codigo}/relatorias.json`,
    ),
    cachedFetch(
      env,
      `legis:${codigo}:votacoes:leg57`,
      `${base}/senador/${codigo}/votacoes.json`,
    ),
    cachedFetch(
      env,
      `legis:${codigo}:votacaoComissao`,
      `${base}/votacaoComissao/parlamentar/${codigo}.json`,
    ).catch(() => null),
    cachedFetch(
      env,
      `legis:${codigo}:liderancas`,
      `${base}/senador/${codigo}/liderancas.json`,
    ).catch(() => null),
    cachedFetch(
      env,
      `legis:${codigo}:cargos`,
      `${base}/senador/${codigo}/cargos.json`,
    ).catch(() => null),
    ...discursosPromises,
    ...apartesPromises,
  ])

  const discursosPorAno = discursosEApartes.slice(0, LEG57_ANOS.length)
  const apartesPorAno = discursosEApartes.slice(LEG57_ANOS.length)

  // ----- Autorias com peso por tipo + status detalhado -----
  let autoriasTotal = 0
  let autoriasAprovadas = 0
  let produtividadePonderada = 0 // soma de pesos × proposições
  let efetividadePonderada = 0 // soma de status × peso_tipo
  let efetividadeBase = 0 // soma de peso_tipo (denominador)

  try {
    const processos = await cachedFetch(
      env,
      `legis:${codigo}:processos:leg57`,
      `${base}/processo?codigoParlamentarAutor=${codigo}&tramitouLegislaturaAtual=S`,
    )
    if (Array.isArray(processos)) {
      autoriasTotal = processos.length
      for (const p of processos as Record<string, unknown>[]) {
        const sigla = extrairSigla(p)
        const peso = PESO_PROPOSICAO[sigla] ?? 0.5
        produtividadePonderada += peso

        const statusPeso = classificarStatus(p)
        if (statusPeso > 0) {
          efetividadePonderada += statusPeso * peso
          if (statusPeso >= PESO_STATUS.APROVADO_SF) autoriasAprovadas += 1
        }
        efetividadeBase += peso
      }
    }
  } catch (err) {
    console.error(`[autorias] erro p/ ${codigo}:`, err)
  }

  // ----- Relatorias (Leg 57) -----
  let relatoriasTotal = 0
  if (relatoriasResult.status === 'fulfilled' && relatoriasResult.value) {
    const val = relatoriasResult.value as Record<string, unknown>
    const mat = val?.MateriasRelatoriaParlamentar as Record<string, unknown>
    const parl = mat?.Parlamentar as Record<string, unknown>
    const itens = extractList(parl ?? mat ?? val, ['Relatorias', 'Relatoria'])
    relatoriasTotal = itens.filter((r) => {
      const dt = String((r as Record<string, unknown>)?.DataDesignacao ?? '')
      return dt >= LEG57_INICIO
    }).length
  }

  // ----- Votações (Leg 57) -----
  let votacoesPresentes = 0
  let votacoesTotal = 0
  if (votacoesResult.status === 'fulfilled' && votacoesResult.value) {
    const val = votacoesResult.value as Record<string, unknown>
    const parl = (val?.VotacaoParlamentar as Record<string, unknown>)
      ?.Parlamentar as Record<string, unknown>
    const itens = extractList(parl ?? val, ['Votacoes', 'Votacao'])
    const leg57 = itens.filter((v) => {
      const dt = String(
        ((v as Record<string, unknown>)?.SessaoPlenaria as Record<string, unknown>)
          ?.DataSessao ?? '',
      )
      return dt >= LEG57_INICIO
    })
    votacoesTotal = leg57.length
    votacoesPresentes = leg57.filter((v) => {
      const voto = String((v as Record<string, unknown>)?.SiglaDescricaoVoto ?? '').toLowerCase()
      return voto === 'votou' || voto === 'sim' || voto === 'não' || voto === 'abstencao'
    }).length
  }

  // ----- Votações em Comissão (Leg 57) -----
  let votacoesComissaoPresentes = 0
  let votacoesComissaoTotal = 0
  if (votacoesComissaoResult.status === 'fulfilled' && votacoesComissaoResult.value) {
    const val = votacoesComissaoResult.value as Record<string, unknown>
    const vc = val?.VotacoesComissao as Record<string, unknown>
    const itens = extractList(vc ?? val, ['Votacoes', 'Votacao'])
    for (const v of itens as Record<string, unknown>[]) {
      const dt = String(v?.DataHoraInicioReuniao ?? '').slice(0, 10)
      if (dt < LEG57_INICIO) continue
      votacoesComissaoTotal += 1
      // Procurar voto do parlamentar dentro da lista
      const votos = v?.Votos as Record<string, unknown>
      const lista = votos ? extractList(votos, ['Voto']) : []
      for (const vt of lista as Record<string, unknown>[]) {
        if (String(vt?.CodigoParlamentar ?? '') === codigo) {
          const qv = String(vt?.QualidadeVoto ?? '').toUpperCase()
          // S=Sim, N=Não, A=Abst, P=Presente não votou
          if (qv === 'S' || qv === 'N' || qv === 'A' || qv === 'P') {
            votacoesComissaoPresentes += 1
          }
          break
        }
      }
    }
  }

  // ----- Discursos -----
  let discursosTotal = 0
  for (const result of discursosPorAno) {
    if (result.status !== 'fulfilled' || !result.value) continue
    const val = result.value as Record<string, unknown>
    const disc = val?.DiscursosParlamentar as Record<string, unknown>
    const parl = disc?.Parlamentar as Record<string, unknown>
    const pron = parl?.Pronunciamentos as Record<string, unknown>
    const itens = pron ? extractList(pron, ['Pronunciamento']) : []
    discursosTotal += itens.length
  }

  // ----- Apartes -----
  let apartesTotal = 0
  for (const result of apartesPorAno) {
    if (result.status !== 'fulfilled' || !result.value) continue
    const val = result.value as Record<string, unknown>
    const apa = val?.ApartesParlamentar as Record<string, unknown>
    const parl = apa?.Parlamentar as Record<string, unknown>
    const apartes = parl?.Apartes as Record<string, unknown>
    const itens = apartes ? extractList(apartes, ['Aparte']) : []
    apartesTotal += itens.length
  }

  // ----- Cargos de liderança (ajuste estrutural Fiscalização) -----
  // Conta lideranças e cargos exercidos na Legislatura 57 — ativos contam
  // peso 1.0; cargos já encerrados (mas dentro da legislatura) contam 0.4,
  // pois ainda evidenciam acesso estrutural a relatorias durante o período.
  const cargosTitulos: string[] = []
  let cargosPeso = 0 // soma contínua para o ajuste
  const hoje = new Date().toISOString().slice(0, 10)

  function classificarPeriodo(
    inicio: string,
    fim: string,
  ): 'ativo' | 'leg57_passado' | 'fora' {
    if (!inicio || inicio < LEG57_INICIO) {
      // Pode ainda estar ativo embora tenha começado antes — vale como ativo
      if (!fim || fim > hoje) return 'ativo'
      // Terminável antes ou durante a leg
      if (fim >= LEG57_INICIO) return 'leg57_passado'
      return 'fora'
    }
    // Iniciado na leg 57
    if (!fim || fim > hoje) return 'ativo'
    return 'leg57_passado'
  }

  if (liderancasResult.status === 'fulfilled' && liderancasResult.value) {
    const val = liderancasResult.value as Record<string, unknown>
    const lid = val?.LiderancaParlamentar as Record<string, unknown>
    const parl = lid?.Parlamentar as Record<string, unknown>
    const itens = extractList(parl ?? lid ?? val, ['Liderancas', 'Lideranca'])
    const titulosVistos = new Set<string>()
    for (const it of itens as Record<string, unknown>[]) {
      const dataIni = String(it?.DataInicio ?? it?.DataDesignacao ?? '')
      const dataFim = String(it?.DataFim ?? it?.DataTermino ?? '')
      const periodo = classificarPeriodo(dataIni, dataFim)
      if (periodo === 'fora') continue
      const desc = String(
        it?.DescricaoTipoLideranca ?? it?.DescricaoCargo ?? 'Liderança',
      )
      const partidoSigla = String(
        (it?.Partido as Record<string, unknown>)?.SiglaPartido ?? '',
      )
      const blocoNome = String(
        (it?.Bloco as Record<string, unknown>)?.ApelidoBloco ??
          (it?.Bloco as Record<string, unknown>)?.NomeBloco ?? '',
      )
      const entidade = partidoSigla || blocoNome
      const sufixo = periodo === 'ativo' ? '' : ' (encerrado)'
      const titulo = entidade ? `${desc} — ${entidade}${sufixo}` : `${desc}${sufixo}`
      if (titulosVistos.has(titulo)) continue
      titulosVistos.add(titulo)
      cargosTitulos.push(titulo)
      cargosPeso += periodo === 'ativo' ? 1.0 : 0.4
    }
  }

  if (cargosResult.status === 'fulfilled' && cargosResult.value) {
    const val = cargosResult.value as Record<string, unknown>
    const car = val?.CargoParlamentar as Record<string, unknown>
    const parl = car?.Parlamentar as Record<string, unknown>
    const itens = extractList(parl ?? car ?? val, ['Cargos', 'Cargo'])
    for (const it of itens as Record<string, unknown>[]) {
      const desc = String(it?.DescricaoCargo ?? '')
      const dl = desc.toLowerCase()
      // Só contar cargos com poder estrutural (presidência, vice, mesa, secretaria)
      const relevante =
        dl.includes('presidente') ||
        dl.includes('mesa') ||
        dl.includes('vice') ||
        dl.includes('secret')
      if (!relevante) continue
      const dataIni = String(it?.DataInicio ?? '')
      const dataFim = String(it?.DataFim ?? '')
      const periodo = classificarPeriodo(dataIni, dataFim)
      if (periodo === 'fora') continue
      const orgao = String(
        (it?.IdentificacaoComissao as Record<string, unknown>)
          ?.NomeComissao ??
          it?.NomeOrgao ??
          '',
      )
      const titulo = orgao ? `${desc} — ${orgao}` : desc
      const sufixo = periodo === 'ativo' ? '' : ' (encerrado)'
      cargosTitulos.push(titulo + sufixo)
      cargosPeso += periodo === 'ativo' ? 1.0 : 0.4
    }
  }

  const cargosLideranca = Math.round(cargosPeso * 10) / 10

  return {
    autoriasTotal,
    autoriasAprovadas,
    produtividadePonderada,
    efetividadePonderada,
    efetividadeBase,
    votacoesPresentes,
    votacoesTotal: Math.max(votacoesTotal, 1),
    votacoesComissaoPresentes,
    votacoesComissaoTotal,
    relatoriasTotal,
    discursosTotal,
    apartesTotal,
    cargosLideranca,
    cargosTitulos: cargosTitulos.slice(0, 10), // máx 10 (inclui histórico recente)
    ceapTotalAno: 0,
  }
}

function extractList(
  obj: Record<string, unknown> | undefined,
  path: string[],
): unknown[] {
  if (!obj) return []
  let cur: unknown = obj
  for (const key of path) {
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[key]
    } else {
      return []
    }
  }
  if (!cur) return []
  return Array.isArray(cur) ? cur : [cur]
}
