'use client'

import type { FilterPreset } from '@/lib/types'

const TABS: { id: FilterPreset; label: string; hint: string }[] = [
  { id: 'geral',      label: 'Geral',          hint: 'Todos em exercício, com IDS regularizado por tempo de mandato' },
  { id: 'titulares',  label: 'Titulares',      hint: 'Apenas titulares em exercício (plenos e que retornaram)' },
  { id: 'suplentes',  label: 'Suplentes',      hint: 'Suplentes que estão exercendo o mandato' },
  { id: 'recentes',   label: 'Recém-empossados', hint: 'Em exercício há menos de 6 meses' },
  { id: 'afastados',  label: 'Afastados',      hint: 'Senadores fora de exercício (ministros, retornados, etc)' },
]

export default function FilterTabs({
  active,
  onChange,
  counts,
}: {
  active: FilterPreset
  onChange: (f: FilterPreset) => void
  counts?: Partial<Record<FilterPreset, number>>
}) {
  return (
    <nav
      role="tablist"
      aria-label="Filtros do ranking"
      className="-mx-1 flex flex-wrap gap-1 border-b border-border"
    >
      {TABS.map((t) => {
        const isActive = active === t.id
        const count = counts?.[t.id]
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            title={t.hint}
            onClick={() => onChange(t.id)}
            className={`relative px-3 py-2 text-xs uppercase tracking-wider font-medium transition-colors
              ${isActive
                ? 'text-ink border-b-2 border-primary -mb-px'
                : 'text-muted hover:text-ink border-b-2 border-transparent -mb-px'}`}
          >
            {t.label}
            {typeof count === 'number' && (
              <span className={`ml-1.5 inline-block rounded-sm px-1 text-[10px] font-mono ${isActive ? 'bg-primary/10 text-primary' : 'bg-border/40 text-muted'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
