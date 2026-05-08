import type {
  RankingResponse,
  MetaResponse,
  IdsScore,
  CeapResponse,
  AfastadosResponse,
  FilterPreset,
} from './types'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'https://api.observasenado.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`)
  }
  return res.json() as Promise<T>
}

export async function getRanking(params?: {
  partido?: string
  uf?: string
  bloco?: string
  filter?: FilterPreset
  status?: string
  meses_min?: number
  ordenar?: string
}): Promise<RankingResponse> {
  const qs = new URLSearchParams()
  if (params?.partido) qs.set('partido', params.partido)
  if (params?.uf) qs.set('uf', params.uf)
  if (params?.bloco) qs.set('bloco', params.bloco)
  if (params?.filter && params.filter !== 'geral') qs.set('filter', params.filter)
  if (params?.status) qs.set('status', params.status)
  if (params?.meses_min) qs.set('meses_min', String(params.meses_min))
  if (params?.ordenar) qs.set('ordenar', params.ordenar)
  const query = qs.toString() ? `?${qs}` : ''
  return apiFetch<RankingResponse>(`/api/ranking${query}`)
}

export async function getAfastados(): Promise<AfastadosResponse> {
  return apiFetch<AfastadosResponse>('/api/ranking?filter=afastados')
}

export async function getRankingMeta(): Promise<MetaResponse> {
  return apiFetch<MetaResponse>('/api/ranking/meta')
}

export async function getSenador(codigo: string): Promise<IdsScore> {
  return apiFetch<IdsScore>(`/api/senador/${codigo}`)
}

export async function getCeap(
  codigo: string,
  ano?: number,
): Promise<CeapResponse> {
  const q = ano ? `?ano=${ano}` : ''
  return apiFetch<CeapResponse>(`/api/ceap/${codigo}${q}`)
}
