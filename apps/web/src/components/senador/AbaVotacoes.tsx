'use client'

import { useEffect, useState } from 'react'
import { getVotacoes } from '@/lib/api'
import type { VotacaoItem, ListResultBase } from '@/lib/types'
import Pagination from './Pagination'

const VOTO_TONE: Record<string, string> = {
  'Sim': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'Não': 'bg-rose-50 text-rose-800 border-rose-200',
  'Nao': 'bg-rose-50 text-rose-800 border-rose-200',
  'Abstenção': 'bg-amber-50 text-amber-800 border-amber-200',
  'Abstencao': 'bg-amber-50 text-amber-800 border-amber-200',
  'Obstrução': 'bg-amber-50 text-amber-800 border-amber-200',
  'Não votou': 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function AbaVotacoes({ codigo }: { codigo: string }) {
  const [data, setData] = useState<ListResultBase<VotacaoItem> | null>(null)
  const [pagina, setPagina] = useState(1)
  const [ano, setAno] = useState<number>(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getVotacoes(codigo, { pagina, porPagina: 25, ano })
      .then(setData)
      .finally(() => setLoading(false))
  }, [codigo, pagina, ano])

  // Agregação simples
  const stats = data?.data ? agregarVotos(data.data) : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <label className="text-muted">Ano:</label>
        <select
          value={ano}
          onChange={(e) => { setAno(Number(e.target.value)); setPagina(1) }}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-sm"
        >
          {[2026, 2025, 2024, 2023].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {data && <span className="text-muted">{data.total} votações</span>}
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-sm overflow-hidden">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-surface px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted font-medium">{k}</p>
              <p className="font-serif text-xl text-ink">{v}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-sm bg-surface border border-border animate-pulse" />)}
        </div>
      ) : data && data.data.length > 0 ? (
        <>
          <ul className="space-y-2">
            {data.data.map((v) => {
              const tone = VOTO_TONE[v.voto] ?? 'bg-panel text-muted border-border'
              return (
                <li key={`${v.codigoSessao}-${v.codigoVotacao}`} className="rounded-sm border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-sm text-ink">{v.identificacao}</span>
                        <span className="text-xs text-muted">{formatBR(v.dataSessao)}</span>
                      </p>
                      <p className="mt-1 text-sm text-muted leading-snug line-clamp-2">{v.descricaoVotacao}</p>
                      {v.ementa && (
                        <p className="mt-1 text-xs text-subtle leading-snug line-clamp-2">{v.ementa}</p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
                      {v.voto || '—'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <Pagination pagina={data.pagina} porPagina={data.porPagina} total={data.total} onChange={setPagina} />
        </>
      ) : (
        <p className="text-muted text-sm">Nenhuma votação encontrada para o ano selecionado.</p>
      )}
    </div>
  )
}

function agregarVotos(arr: VotacaoItem[]): Record<string, number> {
  const r: Record<string, number> = { Sim: 0, Não: 0, Abstenção: 0, Outros: 0 }
  for (const v of arr) {
    const norm = (v.voto || '')
      .replace(/Abstencao/i, 'Abstenção')
      .replace(/^Nao$/i, 'Não')
      .toLowerCase()
    if (norm === 'sim') r.Sim += 1
    else if (norm === 'não' || norm === 'nao') r['Não'] += 1
    else if (norm === 'abstenção' || norm === 'abstencao') r['Abstenção'] += 1
    else r.Outros += 1
  }
  return r
}

function formatBR(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
