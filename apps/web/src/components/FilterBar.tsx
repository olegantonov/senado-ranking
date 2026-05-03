'use client'

import { X } from 'lucide-react'
import type { MetaResponse } from '@/lib/types'

interface Props {
  meta: MetaResponse
  partido: string
  uf: string
  bloco: string
  onPartido: (v: string) => void
  onUf: (v: string) => void
  onBloco: (v: string) => void
  onClear: () => void
}

const selectCls =
  'rounded-sm border border-border bg-surface px-3 py-2 pr-8 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 appearance-none cursor-pointer'

export default function FilterBar({
  meta,
  partido,
  uf,
  bloco,
  onPartido,
  onUf,
  onBloco,
  onClear,
}: Props) {
  const hasFilters = partido || uf || bloco

  return (
    <div className="rounded-sm border border-border bg-panel px-4 py-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted font-medium">
            Partido
          </label>
          <div className="relative">
            <select
              value={partido}
              onChange={(e) => onPartido(e.target.value)}
              className={`${selectCls} min-w-[140px]`}
            >
              <option value="">Todos</option>
              {meta.partidos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">
              ▾
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wider text-muted font-medium">
            Unidade Federativa
          </label>
          <div className="relative">
            <select
              value={uf}
              onChange={(e) => onUf(e.target.value)}
              className={`${selectCls} min-w-[110px]`}
            >
              <option value="">Todas</option>
              {meta.ufs.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">
              ▾
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <label className="text-[11px] uppercase tracking-wider text-muted font-medium">
            Bloco parlamentar
          </label>
          <div className="relative">
            <select
              value={bloco}
              onChange={(e) => onBloco(e.target.value)}
              className={`${selectCls} w-full`}
            >
              <option value="">Todos os blocos</option>
              {meta.blocos.map((b) => (
                <option key={b} value={b}>
                  {b.length > 50 ? b.slice(0, 50) + '…' : b}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">
              ▾
            </span>
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-muted hover:text-primary hover:border-primary/40 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
