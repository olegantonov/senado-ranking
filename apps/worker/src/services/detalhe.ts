/**
 * Listagens detalhadas por senador para subpáginas/popups da UI.
 * Cada função retorna {total, pagina, porPagina, data, fonte, atualizadoEm}.
 *
 * Estratégia: cache filesystem-respeitando o KV-like wrapper (env.SENADO_CACHE).
 * TTLs ajustados por volatilidade. Paginação sempre no servidor.
 */

import type { Env } from '../types'

const LEG57_INICIO = '2023-02-01'

interface Page {
  pagina?: number
  porPagina?: number
}

interface ListResult<T> {
  codigo: string
  total: number
  pagina: number
  porPagina: number
  data: T[]
  fonte: string
  atualizadoEm: string
}

async function cachedGet<T = unknown>(
  env: Env,
  key: string,
  url: string,
  ttlSec: number,
): Promise<T | null> {
  const cached = await env.SENADO_CACHE.get(key, 'json')
  if (cached !== null) return cached as T
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as T
    await env.SENADO_CACHE.put(key, JSON.stringify(data), { expirationTtl: ttlSec })
    return data
  } catch (err) {
    console.warn(`[detalhe] fetch falhou: ${url}`, err)
    return null
  }
}

function paginate<T>(arr: T[], opts: Page): { pagina: number; porPagina: number; data: T[] } {
  const porPagina = Math.min(Math.max(opts.porPagina ?? 50, 1), 200)
  const pagina = Math.max(opts.pagina ?? 1, 1)
  const start = (pagina - 1) * porPagina
  return { pagina, porPagina, data: arr.slice(start, start + porPagina) }
}

function extractList(obj: unknown, path: string[]): unknown[] {
  let cur: unknown = obj
  for (const k of path) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k]
    } else {
      return []
    }
  }
  if (Array.isArray(cur)) return cur
  if (cur != null) return [cur]
  return []
}

const today = () => new Date().toISOString().slice(0, 10)
const isoNow = () => new Date().toISOString()

// ─────────────────────────────────────────────────────────────────────────────
// Perfil (mandatos + filiações + profissão + formação)
// ─────────────────────────────────────────────────────────────────────────────

export interface PerfilSenador {
  codigo: string
  nome: string
  partido?: string
  uf?: string
  email?: string
  telefones?: string[]
  fotoUrl?: string
  paginaSenado?: string
  endereco?: string
  mandatos: Array<{
    legislatura: string
    inicio: string
    fim?: string
    participacao: string
    partido?: string
    suplentes?: Array<{ descricao: string; nome: string }>
  }>
  filiacoes: Array<{ partido: string; dataFiliacao: string; dataDesfiliacao?: string }>
  profissoes: string[]
  formacao: Array<{ nivel: string; curso: string; instituicao?: string }>
  fonte: string
  atualizadoEm: string
}

export async function obterPerfil(env: Env, codigo: string): Promise<PerfilSenador | null> {
  const base = env.LEGIS_BASE_URL
  const fonte = `${base}/senador/${codigo}`

  const [det, mand, prof, form, fil] = await Promise.all([
    cachedGet<Record<string, unknown>>(env, `legis:${codigo}:detalhe`, `${base}/senador/${codigo}.json`, 7 * 86400),
    cachedGet<Record<string, unknown>>(env, `legis:${codigo}:mandatos`, `${base}/senador/${codigo}/mandatos`, 7 * 86400),
    cachedGet<Record<string, unknown>>(env, `legis:${codigo}:profissao`, `${base}/senador/${codigo}/profissao`, 30 * 86400),
    cachedGet<Record<string, unknown>>(env, `legis:${codigo}:formacao`, `${base}/senador/${codigo}/historicoAcademico`, 30 * 86400),
    cachedGet<Record<string, unknown>>(env, `legis:${codigo}:filiacoes`, `${base}/senador/${codigo}/filiacoes`, 7 * 86400),
  ])

  if (!det) return null

  const parl = (det?.DetalheParlamentar as Record<string, unknown>)?.Parlamentar as Record<string, unknown> | undefined
  const ident = parl?.IdentificacaoParlamentar as Record<string, unknown> | undefined
  const dadosBasicos = parl?.DadosBasicosParlamentar as Record<string, unknown> | undefined

  const telefones = extractList(parl, ['Telefones', 'Telefone'])
    .map((t) => String((t as Record<string, unknown>).NumeroTelefone ?? ''))
    .filter(Boolean)

  const mandatos = extractList(mand, ['MandatoParlamentar', 'Parlamentar', 'Mandatos', 'Mandato']).map((m) => {
    const obj = m as Record<string, unknown>
    const part = obj.Partidos as Record<string, unknown> | undefined
    const partidoObj = part?.Partido as Record<string, unknown> | Record<string, unknown>[] | undefined
    const primeiroPartido = Array.isArray(partidoObj) ? partidoObj[0] : partidoObj
    const supl = extractList(obj, ['Suplentes', 'Suplente']).map((s) => {
      const sObj = s as Record<string, unknown>
      return {
        descricao: String(sObj.DescricaoParticipacao ?? ''),
        nome: String(sObj.NomeParlamentar ?? ''),
      }
    })
    const leg1 = obj.PrimeiraLegislaturaDoMandato as Record<string, unknown> | undefined
    const leg2 = obj.SegundaLegislaturaDoMandato as Record<string, unknown> | undefined
    const inicio = String(leg1?.DataInicio ?? leg2?.DataInicio ?? '')
    const fim = String(leg2?.DataFim ?? leg1?.DataFim ?? '')
    return {
      legislatura: `${leg1?.NumeroLegislatura ?? ''}${leg2 ? `/${leg2.NumeroLegislatura}` : ''}`,
      inicio,
      fim: fim || undefined,
      participacao: String(obj.DescricaoParticipacao ?? ''),
      partido: primeiroPartido ? String(primeiroPartido.Sigla ?? '') : undefined,
      suplentes: supl,
    }
  })

  const filiacoes = extractList(fil, ['FiliacaoParlamentar', 'Parlamentar', 'Filiacoes', 'Filiacao']).map((f) => {
    const obj = f as Record<string, unknown>
    const partido = obj.Partido as Record<string, unknown> | undefined
    return {
      partido: String(partido?.SiglaPartido ?? partido?.NomePartido ?? ''),
      dataFiliacao: String(obj.DataFiliacao ?? ''),
      dataDesfiliacao: obj.DataDesfiliacao ? String(obj.DataDesfiliacao) : undefined,
    }
  })

  const profissoes = extractList(prof, ['ProfissaoParlamentar', 'Parlamentar', 'Profissoes', 'Profissao']).map((p) => {
    return String((p as Record<string, unknown>).NomeProfissao ?? '')
  }).filter(Boolean)

  const formacao = extractList(form, ['HistoricoAcademicoParlamentar', 'Parlamentar', 'HistoricosAcademicos', 'HistoricoAcademico']).map((f) => {
    const obj = f as Record<string, unknown>
    return {
      nivel: String(obj.NomeGrauInstrucao ?? obj.GrauInstrucao ?? ''),
      curso: String(obj.NomeCurso ?? ''),
      instituicao: String(obj.NomeInstituicao ?? '') || undefined,
    }
  }).filter((f) => f.curso || f.nivel)

  return {
    codigo,
    nome: String(ident?.NomeParlamentar ?? ''),
    partido: ident?.SiglaPartidoParlamentar ? String(ident.SiglaPartidoParlamentar) : undefined,
    uf: ident?.UfParlamentar ? String(ident.UfParlamentar) : undefined,
    email: ident?.EmailParlamentar ? String(ident.EmailParlamentar) : undefined,
    telefones: telefones.length ? telefones : undefined,
    fotoUrl: ident?.UrlFotoParlamentar ? String(ident.UrlFotoParlamentar) : undefined,
    paginaSenado: ident?.UrlPaginaParlamentar ? String(ident.UrlPaginaParlamentar) : undefined,
    endereco: dadosBasicos?.EnderecoParlamentar ? String(dadosBasicos.EnderecoParlamentar) : undefined,
    mandatos,
    filiacoes,
    profissoes,
    formacao,
    fonte,
    atualizadoEm: isoNow(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autorias (processo)
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoriaItem {
  idProcesso: number
  identificacao: string
  ementa: string
  dataApresentacao: string
  sigla: string
  numero: string
  ano: string
  autoriaTexto?: string
  primeiroAutor?: boolean
  situacao?: string
  ultimoLocal?: string
  url?: string
}

export async function listarAutorias(env: Env, codigo: string, opts: Page & { ano?: number } = {}): Promise<ListResult<AutoriaItem>> {
  const base = env.LEGIS_BASE_URL
  const url = `${base}/processo?codigoParlamentarAutor=${codigo}&tramitouLegislaturaAtual=S`
  const data = (await cachedGet<unknown[]>(env, `legis:${codigo}:processos:leg57`, url, 12 * 3600)) ?? []
  const arr = Array.isArray(data) ? data : []

  let filtrado = arr.map((p) => {
    const obj = p as Record<string, unknown>
    const ident = String(obj.identificacao ?? '')
    const partes = ident.split(/[\s/]/)
    return {
      idProcesso: Number(obj.id ?? 0),
      identificacao: ident,
      ementa: String(obj.ementa ?? ''),
      dataApresentacao: String(obj.dataApresentacao ?? '').slice(0, 10),
      sigla: partes[0] ?? '',
      numero: partes[1] ?? '',
      ano: partes[2] ?? '',
      autoriaTexto: obj.autoria ? String(obj.autoria) : undefined,
      situacao: obj.descricaoSituacao ? String(obj.descricaoSituacao) : obj.statusAtual ? String(obj.statusAtual) : undefined,
      ultimoLocal: obj.localAtual ? String(obj.localAtual) : undefined,
      url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${obj.codigoMateria ?? obj.id}`,
    } as AutoriaItem
  })

  if (opts.ano) {
    const anoStr = String(opts.ano)
    filtrado = filtrado.filter((a) => a.ano === anoStr || a.dataApresentacao.startsWith(anoStr))
  }

  filtrado.sort((a, b) => (b.dataApresentacao || '').localeCompare(a.dataApresentacao || ''))
  const { pagina, porPagina, data: page } = paginate(filtrado, opts)
  return { codigo, total: filtrado.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Relatorias (processo/relatoria)
// ─────────────────────────────────────────────────────────────────────────────

export interface RelatoriaItem {
  idProcesso: number
  codigoMateria?: number
  identificacao?: string
  ementa: string
  comissaoCodigo?: number
  comissaoSigla?: string
  comissaoNome?: string
  papel: string
  dataDesignacao: string
  dataDestituicao?: string
  encerramento?: string
  url?: string
}

export async function listarRelatorias(env: Env, codigo: string, opts: Page & { ano?: number } = {}): Promise<ListResult<RelatoriaItem>> {
  const base = env.LEGIS_BASE_URL
  const url = `${base}/processo/relatoria?codigoParlamentar=${codigo}&dataInicio=${LEG57_INICIO}&dataFim=${today()}`
  // chave distinta da usada por services/legis.ts (formato deprecated antigo)
  const data = (await cachedGet<unknown[]>(env, `legis:${codigo}:processoRelatoria:leg57`, url, 12 * 3600)) ?? []
  const arr = Array.isArray(data) ? data : []

  let mapped = arr.map((r) => {
    const obj = r as Record<string, unknown>
    return {
      idProcesso: Number(obj.idProcesso ?? 0),
      codigoMateria: obj.codigoMateria ? Number(obj.codigoMateria) : undefined,
      identificacao: obj.identificacaoMateria ? String(obj.identificacaoMateria) : undefined,
      ementa: String(obj.ementaProcesso ?? obj.ementaMateria ?? ''),
      comissaoCodigo: obj.codigoColegiado ? Number(obj.codigoColegiado) : undefined,
      comissaoSigla: obj.siglaColegiado ? String(obj.siglaColegiado) : undefined,
      comissaoNome: obj.nomeColegiado ? String(obj.nomeColegiado) : undefined,
      papel: String(obj.descricaoTipoRelator ?? 'Relator'),
      dataDesignacao: String(obj.dataDesignacao ?? '').slice(0, 10),
      dataDestituicao: obj.dataDestituicao ? String(obj.dataDestituicao).slice(0, 10) : undefined,
      encerramento: obj.descricaoTipoEncerramento ? String(obj.descricaoTipoEncerramento) : undefined,
      url: obj.codigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${obj.codigoMateria}` : undefined,
    } as RelatoriaItem
  })

  if (opts.ano) {
    const anoStr = String(opts.ano)
    mapped = mapped.filter((r) => r.dataDesignacao.startsWith(anoStr))
  }

  mapped.sort((a, b) => b.dataDesignacao.localeCompare(a.dataDesignacao))
  const { pagina, porPagina, data: page } = paginate(mapped, opts)
  return { codigo, total: mapped.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Votações (votação nominal por parlamentar)
// ─────────────────────────────────────────────────────────────────────────────

export interface VotacaoItem {
  codigoSessao: number
  codigoVotacao: number
  dataSessao: string
  identificacao: string
  ementa: string
  descricaoVotacao: string
  voto: string
  resultado?: string
  url?: string
}

export async function listarVotacoes(env: Env, codigo: string, opts: Page & { ano?: number } = {}): Promise<ListResult<VotacaoItem>> {
  const base = env.LEGIS_BASE_URL
  const ano = opts.ano ?? new Date().getFullYear()
  const url = `${base}/votacao?codigoParlamentar=${codigo}&dataInicio=${ano}-01-01&dataFim=${ano}-12-31`
  const data = (await cachedGet<unknown[]>(env, `legis:${codigo}:votacao:${ano}`, url, 6 * 3600)) ?? []
  const arr = Array.isArray(data) ? data : []

  const mapped = arr.map((v) => {
    const obj = v as Record<string, unknown>
    // O voto individual do parlamentar vem aninhado em votos[]:
    //   votos[0] = { codigoParlamentar, siglaVotoParlamentar: "Sim"|"Não"|"Abstenção"|"Não votou"|... }
    // Como filtramos por codigoParlamentar, há sempre 1 item nessa lista.
    const votosArr = (obj.votos as Array<Record<string, unknown>>) ?? []
    const meuVoto = votosArr[0] ?? {}
    return {
      codigoSessao: Number(obj.codigoSessao ?? 0),
      codigoVotacao: Number(obj.codigoSessaoVotacao ?? obj.codigoVotacaoSve ?? 0),
      dataSessao: String(obj.dataSessao ?? '').slice(0, 10),
      identificacao: String(obj.identificacao ?? ''),
      ementa: String(obj.ementa ?? ''),
      descricaoVotacao: String(obj.descricaoVotacao ?? ''),
      voto: String(meuVoto.siglaVotoParlamentar ?? meuVoto.descricaoVotoParlamentar ?? ''),
      resultado: obj.resultadoVotacao ? String(obj.resultadoVotacao) : undefined,
      url: obj.idProcesso ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${obj.codigoMateria ?? obj.idProcesso}` : undefined,
    } as VotacaoItem
  })

  mapped.sort((a, b) => b.dataSessao.localeCompare(a.dataSessao))
  const { pagina, porPagina, data: page } = paginate(mapped, opts)
  return { codigo, total: mapped.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comissões (membro)
// ─────────────────────────────────────────────────────────────────────────────

export interface ComissaoItem {
  codigo: string
  sigla: string
  nome: string
  casa?: string
  participacao: string
  dataInicio: string
  dataFim?: string
  ativo: boolean
}

export async function listarComissoes(env: Env, codigo: string, opts: Page & { ativo?: boolean } = {}): Promise<ListResult<ComissaoItem>> {
  const base = env.LEGIS_BASE_URL
  const url = `${base}/senador/${codigo}/comissoes${opts.ativo === false ? '' : '?ativo=S'}`
  const data = await cachedGet<Record<string, unknown>>(env, `legis:${codigo}:comissoes:${opts.ativo === false ? 'todas' : 'ativas'}`, url, 24 * 3600)
  const arr = extractList(data, ['MembroComissaoParlamentar', 'Parlamentar', 'MembroComissoes', 'Comissao'])

  const mapped: ComissaoItem[] = arr.map((c) => {
    const obj = c as Record<string, unknown>
    const id = obj.IdentificacaoComissao as Record<string, unknown> | undefined
    return {
      codigo: String(id?.CodigoComissao ?? ''),
      sigla: String(id?.SiglaComissao ?? ''),
      nome: String(id?.NomeComissao ?? ''),
      casa: id?.SiglaCasaComissao ? String(id.SiglaCasaComissao) : undefined,
      participacao: String(obj.DescricaoParticipacao ?? ''),
      dataInicio: String(obj.DataInicio ?? '').slice(0, 10),
      dataFim: obj.DataFim ? String(obj.DataFim).slice(0, 10) : undefined,
      ativo: !obj.DataFim,
    }
  })

  mapped.sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.dataInicio.localeCompare(a.dataInicio))
  const { pagina, porPagina, data: page } = paginate(mapped, opts)
  return { codigo, total: mapped.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cargos (mesa, presidências, frentes etc)
// ─────────────────────────────────────────────────────────────────────────────

export interface CargoItem {
  cargo: string
  comissaoCodigo?: string
  comissaoSigla?: string
  comissaoNome?: string
  casa?: string
  dataInicio: string
  dataFim?: string
  ativo: boolean
}

export async function listarCargos(env: Env, codigo: string, opts: Page & { ativo?: boolean } = {}): Promise<ListResult<CargoItem>> {
  const base = env.LEGIS_BASE_URL
  const url = `${base}/senador/${codigo}/cargos${opts.ativo === false ? '' : '?ativo=S'}`
  const data = await cachedGet<Record<string, unknown>>(env, `legis:${codigo}:cargosDet:${opts.ativo === false ? 'todos' : 'ativos'}`, url, 24 * 3600)
  const arr = extractList(data, ['CargoParlamentar', 'Parlamentar', 'Cargos', 'Cargo'])

  const mapped: CargoItem[] = arr.map((c) => {
    const obj = c as Record<string, unknown>
    const id = obj.IdentificacaoComissao as Record<string, unknown> | undefined
    return {
      cargo: String(obj.DescricaoCargo ?? ''),
      comissaoCodigo: id?.CodigoComissao ? String(id.CodigoComissao) : undefined,
      comissaoSigla: id?.SiglaComissao ? String(id.SiglaComissao) : undefined,
      comissaoNome: id?.NomeComissao ? String(id.NomeComissao) : undefined,
      casa: id?.SiglaCasaComissao ? String(id.SiglaCasaComissao) : undefined,
      dataInicio: String(obj.DataInicio ?? '').slice(0, 10),
      dataFim: obj.DataFim ? String(obj.DataFim).slice(0, 10) : undefined,
      ativo: !obj.DataFim,
    }
  })

  mapped.sort((a, b) => Number(b.ativo) - Number(a.ativo) || b.dataInicio.localeCompare(a.dataInicio))
  const { pagina, porPagina, data: page } = paginate(mapped, opts)
  return { codigo, total: mapped.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Discursos / Apartes
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscursoItem {
  codigoPronunciamento: string
  data: string
  casa: string
  tipoUsoPalavra: string
  resumo: string
  urlTextoIntegral?: string
  urlTextoBinario?: string
}

export async function listarDiscursos(env: Env, codigo: string, opts: Page & { ano?: number } = {}): Promise<ListResult<DiscursoItem>> {
  const base = env.LEGIS_BASE_URL
  const ano = opts.ano ?? new Date().getFullYear()
  const url = `${base}/senador/${codigo}/discursos?dataIni=${ano}0101&dataFim=${ano}1231`
  const data = await cachedGet<Record<string, unknown>>(env, `legis:${codigo}:discursos:${ano}`, url, 6 * 3600)
  const arr = extractList(data, ['DiscursosParlamentar', 'Parlamentar', 'Pronunciamentos', 'Pronunciamento'])

  const mapped: DiscursoItem[] = arr.map((d) => {
    const obj = d as Record<string, unknown>
    const tipo = obj.TipoUsoPalavra as Record<string, unknown> | undefined
    const id = String(obj.CodigoPronunciamento ?? '')
    return {
      codigoPronunciamento: id,
      data: String(obj.DataPronunciamento ?? '').slice(0, 10),
      casa: String(obj.NomeCasaPronunciamento ?? obj.SiglaCasaPronunciamento ?? ''),
      tipoUsoPalavra: String(tipo?.Descricao ?? ''),
      resumo: String(obj.TextoResumo ?? ''),
      urlTextoIntegral: id ? `${base}/discurso/texto-integral/${id}` : undefined,
      urlTextoBinario: id ? `${base}/discurso/texto-binario/${id}` : undefined,
    }
  })

  mapped.sort((a, b) => b.data.localeCompare(a.data))
  const { pagina, porPagina, data: page } = paginate(mapped, opts)
  return { codigo, total: mapped.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

export async function listarApartes(env: Env, codigo: string, opts: Page & { ano?: number } = {}): Promise<ListResult<DiscursoItem>> {
  const base = env.LEGIS_BASE_URL
  const ano = opts.ano ?? new Date().getFullYear()
  const url = `${base}/senador/${codigo}/apartes?dataIni=${ano}0101&dataFim=${ano}1231`
  const data = await cachedGet<Record<string, unknown>>(env, `legis:${codigo}:apartes:${ano}`, url, 6 * 3600)
  const arr = extractList(data, ['ApartesParlamentar', 'Parlamentar', 'Apartes', 'Aparte'])

  const mapped: DiscursoItem[] = arr.map((d) => {
    const obj = d as Record<string, unknown>
    const tipo = obj.TipoUsoPalavra as Record<string, unknown> | undefined
    const id = String(obj.CodigoPronunciamento ?? '')
    return {
      codigoPronunciamento: id,
      data: String(obj.DataPronunciamento ?? '').slice(0, 10),
      casa: String(obj.NomeCasaPronunciamento ?? obj.SiglaCasaPronunciamento ?? ''),
      tipoUsoPalavra: String(tipo?.Descricao ?? 'Aparte'),
      resumo: String(obj.TextoResumo ?? ''),
      urlTextoIntegral: id ? `${base}/discurso/texto-integral/${id}` : undefined,
    }
  })

  mapped.sort((a, b) => b.data.localeCompare(a.data))
  const { pagina, porPagina, data: page } = paginate(mapped, opts)
  return { codigo, total: mapped.length, pagina, porPagina, data: page, fonte: url, atualizadoEm: isoNow() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Despesas detalhadas (CEAP) — transação a transação
// ─────────────────────────────────────────────────────────────────────────────

export interface DespesaItem {
  id: number
  ano: number
  mes: number
  data?: string
  tipoDocumento: string
  tipoDespesa: string
  cpfCnpj: string
  fornecedor: string
  documento?: string
  detalhamento?: string
  valor: number
}

export interface DespesasResumo {
  totalAno: number
  totalTransacoes: number
  porTipo: Array<{ tipo: string; total: number; transacoes: number }>
  porMes: Array<{ mes: number; total: number }>
  topFornecedores: Array<{ nome: string; cpfCnpj: string; total: number; transacoes: number }>
}

export async function listarDespesasDetalhadas(
  env: Env,
  codigo: string,
  ano: number,
  opts: Page & { tipo?: string; fornecedor?: string } = {},
): Promise<ListResult<DespesaItem> & { resumo: DespesasResumo }> {
  const base = env.ADM_BASE_URL
  const url = `${base}/api/v1/senadores/despesas_ceaps/${ano}`
  const isAnoCorrente = ano >= new Date().getFullYear()
  const ttl = isAnoCorrente ? 6 * 3600 : 30 * 86400
  const data = (await cachedGet<unknown[]>(env, `adm:ceapDetalhe:${ano}`, url, ttl)) ?? []
  const arr = Array.isArray(data) ? data : []

  const codNum = Number(codigo)
  const mine = arr.filter((d) => Number((d as Record<string, unknown>).codSenador) === codNum)

  const itens: DespesaItem[] = mine.map((d) => {
    const obj = d as Record<string, unknown>
    return {
      id: Number(obj.id ?? 0),
      ano: Number(obj.ano ?? ano),
      mes: Number(obj.mes ?? 0),
      data: obj.data ? String(obj.data).slice(0, 10) : undefined,
      tipoDocumento: String(obj.tipoDocumento ?? ''),
      tipoDespesa: String(obj.tipoDespesa ?? ''),
      cpfCnpj: String(obj.cpfCnpj ?? ''),
      fornecedor: String(obj.fornecedor ?? ''),
      documento: obj.documento ? String(obj.documento) : undefined,
      detalhamento: obj.detalhamento ? String(obj.detalhamento) : undefined,
      valor: Number(obj.valorReembolsado ?? 0),
    }
  })

  // Resumo (sobre TODOS os itens do ano, não só a página)
  const porTipoMap = new Map<string, { total: number; transacoes: number }>()
  const porMesMap = new Map<number, number>()
  const porForn = new Map<string, { nome: string; cpfCnpj: string; total: number; transacoes: number }>()
  let totalAno = 0
  for (const it of itens) {
    totalAno += it.valor
    const tipoEntry = porTipoMap.get(it.tipoDespesa) ?? { total: 0, transacoes: 0 }
    tipoEntry.total += it.valor
    tipoEntry.transacoes += 1
    porTipoMap.set(it.tipoDespesa, tipoEntry)
    porMesMap.set(it.mes, (porMesMap.get(it.mes) ?? 0) + it.valor)
    const key = it.cpfCnpj || it.fornecedor
    const fornEntry = porForn.get(key) ?? { nome: it.fornecedor, cpfCnpj: it.cpfCnpj, total: 0, transacoes: 0 }
    fornEntry.total += it.valor
    fornEntry.transacoes += 1
    porForn.set(key, fornEntry)
  }

  const resumo: DespesasResumo = {
    totalAno: Math.round(totalAno * 100) / 100,
    totalTransacoes: itens.length,
    porTipo: [...porTipoMap.entries()]
      .map(([tipo, v]) => ({ tipo, total: Math.round(v.total * 100) / 100, transacoes: v.transacoes }))
      .sort((a, b) => b.total - a.total),
    porMes: [...porMesMap.entries()]
      .map(([mes, total]) => ({ mes, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.mes - b.mes),
    topFornecedores: [...porForn.values()]
      .map((f) => ({ ...f, total: Math.round(f.total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20),
  }

  // Filtros opcionais
  let filtrado = itens
  if (opts.tipo) filtrado = filtrado.filter((i) => i.tipoDespesa.toLowerCase().includes(opts.tipo!.toLowerCase()))
  if (opts.fornecedor) filtrado = filtrado.filter((i) => i.fornecedor.toLowerCase().includes(opts.fornecedor!.toLowerCase()))

  filtrado.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? '') || b.mes - a.mes)
  const { pagina, porPagina, data: page } = paginate(filtrado, opts)

  return {
    codigo,
    total: filtrado.length,
    pagina,
    porPagina,
    data: page,
    resumo,
    fonte: url,
    atualizadoEm: isoNow(),
  }
}
