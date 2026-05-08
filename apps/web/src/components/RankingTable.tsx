'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { IdsScore, SortKey, SortDir } from '@/lib/types'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { StatusBadge } from './StatusBadge'

const PAGE_SIZE = 25

function idsClasses(v: number): { text: string; bg: string; border: string } {
  if (v >= 75) return { text: 'text-[#14532d]', bg: 'bg-[#dcfce7]', border: 'border-[#86efac]' }
  if (v >= 55) return { text: 'text-[#1e7d4a]', bg: 'bg-[#ecfdf5]', border: 'border-[#a7f3d0]' }
  if (v >= 40) return { text: 'text-[#92742a]', bg: 'bg-[#fef9c3]', border: 'border-[#fde68a]' }
  if (v >= 25) return { text: 'text-[#9b6608]', bg: 'bg-[#fff7ed]', border: 'border-[#fed7aa]' }
  return { text: 'text-[#9b2c2c]', bg: 'bg-[#fef2f2]', border: 'border-[#fecaca]' }
}

interface Column {
  key: SortKey
  label: string
  short?: string
  numeric?: boolean
}

const COLUMNS: Column[] = [
  { key: 'nome', label: 'Senador' },
  { key: 'partido', label: 'Partido', short: 'Part.' },
  { key: 'uf', label: 'UF' },
  { key: 'idsTotal', label: 'IDS', numeric: true },
  { key: 'dimProdutividade', label: 'Produtividade', short: 'Prod.', numeric: true },
  { key: 'dimEfetividade', label: 'Efetividade', short: 'Efet.', numeric: true },
  { key: 'dimParticipacao', label: 'Participação', short: 'Part.', numeric: true },
  { key: 'dimFiscalizacao', label: 'Fiscalização', short: 'Fisc.', numeric: true },
  { key: 'dimCeap', label: 'CEAP', numeric: true },
  { key: 'dimTransparencia', label: 'Transparência', short: 'Transp.', numeric: true },
]

interface Props {
  scores: IdsScore[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
}

export default function RankingTable({ scores, sortKey, sortDir, onSort }: Props) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(scores.length / PAGE_SIZE)
  const pageItems = scores.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when filters change result set length significantly
  useEffect(() => {
    setPage(1)
  }, [scores.length, sortKey, sortDir])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-sm border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-panel">
            <tr className="border-b border-border">
              <th className="px-3 py-3 text-left text-muted font-semibold w-12 text-[11px] uppercase tracking-wider">
                Pos.
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-3 font-semibold cursor-pointer select-none hover:bg-border/40 transition-colors group text-[11px] uppercase tracking-wider ${
                    col.numeric ? 'text-right' : 'text-left'
                  }`}
                  onClick={() => onSort(col.key)}
                >
                  <span
                    className={`flex items-center gap-1 text-muted group-hover:text-primary ${
                      col.numeric ? 'justify-end' : ''
                    }`}
                  >
                    <span className="hidden md:inline">{col.label}</span>
                    <span className="md:hidden">{col.short ?? col.label}</span>
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s, i) => {
              const rank = (page - 1) * PAGE_SIZE + i + 1
              const cls = idsClasses(s.idsTotal)
              return (
                <tr
                  key={s.senadorCod}
                  className="border-b border-border last:border-b-0 hover:bg-panel transition-colors"
                >
                  <td className="px-3 py-3 font-mono text-muted text-xs align-middle">
                    {rank}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/senador?codigo=${s.senadorCod}`}
                      className="flex items-center gap-3 group"
                    >
                      {s.fotoUrl ? (
                        <img
                          src={s.fotoUrl}
                          alt={s.nome}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-border flex-shrink-0" />
                      )}
                      <span className="flex flex-col">
                        <span className="font-medium text-ink group-hover:text-primary group-hover:underline underline-offset-2 transition-colors">
                          {s.nome}
                        </span>
                        {s.status && (
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <StatusBadge status={s.status} />
                            {s.mesesAtivos != null && (
                              <span
                                className="text-[10px] text-muted font-mono"
                                title={s.confianca ? `Confiança ${s.confianca}` : undefined}
                              >
                                {s.mesesAtivos}m
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted text-sm">{s.partido}</td>
                  <td className="px-3 py-3 text-muted text-sm">{s.uf}</td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-block font-mono font-bold text-sm px-2 py-0.5 rounded-sm border ${cls.text} ${cls.bg} ${cls.border}`}
                    >
                      {s.idsTotal}
                    </span>
                  </td>
                  {(
                    [
                      s.dimProdutividade,
                      s.dimEfetividade,
                      s.dimParticipacao,
                      s.dimFiscalizacao,
                      s.dimCeap,
                      s.dimTransparencia,
                    ] as number[]
                  ).map((v, di) => (
                    <td key={di} className="px-3 py-3">
                      <ScoreBar value={v} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Exibindo <strong className="text-ink">{(page - 1) * PAGE_SIZE + 1}</strong>–
            <strong className="text-ink">
              {Math.min(page * PAGE_SIZE, scores.length)}
            </strong>{' '}
            de <strong className="text-ink">{scores.length}</strong> Senadores
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-primary hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              const p =
                totalPages <= 7
                  ? i + 1
                  : page <= 4
                    ? i + 1
                    : page >= totalPages - 3
                      ? totalPages - 6 + i
                      : page - 3 + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                    p === page
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-surface text-muted hover:text-primary hover:border-primary/40'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-sm border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-primary hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  const color =
    value >= 75
      ? '#1e7d4a'
      : value >= 55
        ? '#65a30d'
        : value >= 40
          ? '#b8860b'
          : value >= 25
            ? '#c2410c'
            : '#9b2c2c'

  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="h-1.5 w-16 rounded-full bg-border">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="font-mono text-xs text-muted w-7 text-right">{value}</span>
    </div>
  )
}
