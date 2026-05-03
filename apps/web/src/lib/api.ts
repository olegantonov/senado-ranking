import type { RankingResponse, MetaResponse, IdsScore, CeapResponse } from './types'

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
}): Promise<RankingResponse> {
  const qs = new URLSearchParams()
  if (params?.partido) qs.set('partido', params.partido)
  if (params?.uf) qs.set('uf', params.uf)
  if (params?.bloco) qs.set('bloco', params.bloco)
  const query = qs.toString() ? `?${qs}` : ''
  return apiFetch<RankingResponse>(`/api/ranking${query}`)
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
