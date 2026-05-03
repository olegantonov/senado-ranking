import type { Env, CeapMes } from '../types'

const CACHE_TTL_SECONDS = 6 * 60 * 60
const LEG57_ANOS = [2023, 2024, 2025, 2026]

async function cachedFetch(
  env: Env,
  cacheKey: string,
  url: string,
): Promise<unknown> {
  const cached = await env.SENADO_CACHE.get(cacheKey, 'json')
  if (cached !== null) return cached

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  const data = await res.json()
  await env.SENADO_CACHE.put(cacheKey, JSON.stringify(data), {
    expirationTtl: CACHE_TTL_SECONDS,
  })
  return data
}

async function getCeapByYear(
  env: Env,
  ano: number,
): Promise<Record<string, number>> {
  const cacheKey = `adm:ceap:${ano}`
  const data = await cachedFetch(
    env,
    cacheKey,
    `${env.ADM_BASE_URL}/api/v1/senadores/despesas_ceaps/${ano}`,
  )

  const totais: Record<string, number> = {}
  if (!data || !Array.isArray(data)) return totais

  for (const reg of data as Record<string, unknown>[]) {
    const cod = String(reg?.codSenador ?? '')
    const valor = Number(reg?.valorReembolsado ?? 0)
    if (cod && cod !== 'undefined') {
      totais[cod] = (totais[cod] ?? 0) + valor
    }
  }
  return totais
}

/**
 * Retorna CEAP total acumulado de cada senador na legislatura 57 inteira.
 */
export async function getCeapLeg57(
  env: Env,
): Promise<Record<string, number>> {
  const totais: Record<string, number> = {}
  for (const ano of LEG57_ANOS) {
    const ceapAno = await getCeapByYear(env, ano)
    for (const [cod, valor] of Object.entries(ceapAno)) {
      totais[cod] = (totais[cod] ?? 0) + valor
    }
  }
  return totais
}

export async function getCeapMensal(
  env: Env,
  codigoParlamentar: string,
  ano: number,
): Promise<CeapMes[]> {
  const cacheKey = `adm:ceap:ano:${ano}`
  const data = await cachedFetch(
    env,
    cacheKey,
    `${env.ADM_BASE_URL}/api/v1/senadores/despesas_ceaps/${ano}`,
  )

  const meses: Record<number, number> = {}
  if (!data || !Array.isArray(data)) return []

  for (const reg of data as Record<string, unknown>[]) {
    const cod = String(reg?.codSenador ?? '')
    if (cod !== codigoParlamentar) continue
    const mes = Number(reg?.mes ?? 0)
    const valor = Number(reg?.valorReembolsado ?? 0)
    if (mes >= 1 && mes <= 12) {
      meses[mes] = (meses[mes] ?? 0) + valor
    }
  }

  return Object.entries(meses)
    .map(([mes, valorTotal]) => ({ mes: parseInt(mes, 10), ano, valorTotal }))
    .sort((a, b) => a.mes - b.mes)
}

/**
 * Retorna mapa nomeNormalizado → { auxilioMoradia, imovelFuncional }
 * (API não tem código do senador, usa nome — fazemos match por nome normalizado).
 */
export async function getAuxiliosMoradia(
  env: Env,
): Promise<Record<string, { auxilioMoradia: boolean; imovelFuncional: boolean }>> {
  const data = await cachedFetch(
    env,
    'adm:auxilios:moradia',
    `${env.ADM_BASE_URL}/api/v1/senadores/auxilio-moradia`,
  )

  const result: Record<string, { auxilioMoradia: boolean; imovelFuncional: boolean }> = {}
  if (!data || !Array.isArray(data)) return result

  for (const reg of data as Record<string, unknown>[]) {
    const nome = normalizeNome(String(reg?.nomeParlamentar ?? ''))
    if (!nome) continue
    result[nome] = {
      auxilioMoradia: Boolean(reg?.auxilioMoradia),
      imovelFuncional: Boolean(reg?.imovelFuncional),
    }
  }
  return result
}

/**
 * Retorna mapa codSenador → { total, divulgacao, escritorio, locomocao, consultoria, outros }
 * para a legislatura inteira (somando todos os anos).
 */
export async function getCeapBreakdownLeg57(
  env: Env,
): Promise<
  Record<
    string,
    {
      total: number
      divulgacao: number
      escritorio: number
      locomocao: number
      consultoria: number
      outros: number
    }
  >
> {
  const out: Record<
    string,
    {
      total: number
      divulgacao: number
      escritorio: number
      locomocao: number
      consultoria: number
      outros: number
    }
  > = {}

  for (const ano of LEG57_ANOS) {
    const data = await cachedFetch(
      env,
      `adm:ceap:ano:${ano}`,
      `${env.ADM_BASE_URL}/api/v1/senadores/despesas_ceaps/${ano}`,
    )
    if (!data || !Array.isArray(data)) continue

    for (const reg of data as Record<string, unknown>[]) {
      const cod = String(reg?.codSenador ?? '')
      if (!cod || cod === 'undefined') continue
      const valor = Number(reg?.valorReembolsado ?? 0)
      const tipo = String(reg?.tipoDespesa ?? '').toLowerCase()

      if (!out[cod]) {
        out[cod] = {
          total: 0,
          divulgacao: 0,
          escritorio: 0,
          locomocao: 0,
          consultoria: 0,
          outros: 0,
        }
      }
      const b = out[cod]
      b.total += valor

      if (tipo.includes('divulga')) {
        b.divulgacao += valor
      } else if (tipo.includes('escritório') || tipo.includes('aluguel') || tipo.includes('material de consumo')) {
        b.escritorio += valor
      } else if (tipo.includes('passag') || tipo.includes('locomo') || tipo.includes('combust')) {
        b.locomocao += valor
      } else if (tipo.includes('consultor') || tipo.includes('assessoria') || tipo.includes('pesquisa')) {
        b.consultoria += valor
      } else {
        b.outros += valor
      }
    }
  }
  return out
}

/**
 * Retorna mapa nomeNormalizado → numero de escritórios de apoio.
 * (API não expoe código do senador, usamos nome.)
 */
export async function getEscritoriosCount(
  env: Env,
): Promise<Record<string, number>> {
  const data = await cachedFetch(
    env,
    'adm:escritorios:lista',
    `${env.ADM_BASE_URL}/api/v1/senadores/escritorios`,
  )
  const out: Record<string, number> = {}
  if (!data || !Array.isArray(data)) return out
  for (const reg of data as Record<string, unknown>[]) {
    const nome = normalizeNome(String(reg?.nome ?? ''))
    if (!nome) continue
    out[nome] = (out[nome] ?? 0) + 1
  }
  return out
}

export function normalizeNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
