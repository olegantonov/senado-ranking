'use client'

import { useEffect, useState, useRef } from 'react'
import { getRanking } from '@/lib/api'
import type { IdsScore } from '@/lib/types'
import SenadorRadar from '@/components/SenadorRadar'
import Link from 'next/link'

const COLORS = ['#1e3a5f', '#b8860b', '#1e7d4a', '#9b2c2c', '#6b4f9a']

export default function CompararPage() {
  const [query, setQuery] = useState('')
  const [allScores, setAllScores] = useState<IdsScore[]>([])
  const [selected, setSelected] = useState<IdsScore[]>([])
  const [suggestions, setSuggestions] = useState<IdsScore[]>([])
  const [loadingAll, setLoadingAll] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getRanking()
      .then((r) => setAllScores(r.data))
      .catch(console.error)
      .finally(() => setLoadingAll(false))
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    const q = query.toLowerCase()
    setSuggestions(
      allScores
        .filter(
          (s) =>
            s.nome.toLowerCase().includes(q) ||
            s.partido.toLowerCase().includes(q) ||
            s.uf.toLowerCase().includes(q),
        )
        .slice(0, 6),
    )
  }, [query, allScores])

  function addSenador(s: IdsScore) {
    if (selected.length >= 5) return
    if (selected.find((x) => x.senadorCod === s.senadorCod)) return
    setSelected((prev) => [...prev, s])
    setQuery('')
    setSuggestions([])
    inputRef.current?.focus()
  }

  function removeSenador(cod: string) {
    setSelected((prev) => prev.filter((s) => s.senadorCod !== cod))
  }

  const dims = [
    { key: 'dimProdutividade', label: 'Produtividade Legislativa' },
    { key: 'dimEfetividade', label: 'Efetividade' },
    { key: 'dimParticipacao', label: 'Participação' },
    { key: 'dimFiscalizacao', label: 'Fiscalização' },
    { key: 'dimCeap', label: 'Eficiência CEAP' },
    { key: 'dimTransparencia', label: 'Transparência' },
  ]

  return (
    <div className="space-y-10 fade-in">
      {/* ============= ABERTURA ============= */}
      <section className="border-b border-border pb-8">
        <p className="eyebrow">Análise Comparativa</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink">
          Comparação entre Senadores
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">
          Selecione até cinco Senadores para visualizar lado a lado as
          pontuações em cada uma das seis dimensões do Índice de Desempenho
          Senatorial. Esta ferramenta é especialmente útil para análise de
          bancadas, contraste entre titulares e suplentes, ou estudos
          regionais.
        </p>
      </section>

      {/* ============= BUSCA ============= */}
      <section>
        <p className="eyebrow mb-2">Selecionar Parlamentares</p>
        <div className="relative max-w-xl">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o nome, partido ou unidade federativa..."
            className="w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-sm border border-border bg-surface shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.senadorCod}
                  onClick={() => addSenador(s)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-panel transition-colors border-b border-border last:border-b-0"
                >
                  <span className="text-sm font-medium text-ink">{s.nome}</span>
                  <span className="ml-auto text-xs text-muted">
                    {s.partido} · {s.uf}
                  </span>
                  <span className="text-xs font-mono font-semibold text-primary">
                    IDS {s.idsTotal}
                  </span>
                </button>
              ))}
            </div>
          )}
          {loadingAll && (
            <p className="mt-2 text-xs text-muted">Carregando lista…</p>
          )}
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.map((s, i) => (
              <div
                key={s.senadorCod}
                className="flex items-center gap-2 rounded-sm border bg-surface px-3 py-1.5 text-sm"
                style={{ borderColor: COLORS[i], color: COLORS[i] }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COLORS[i] }}
                />
                <span className="font-medium">{s.nome}</span>
                <span className="opacity-70 text-xs">
                  ({s.partido}/{s.uf})
                </span>
                <button
                  onClick={() => removeSenador(s.senadorCod)}
                  className="ml-1 opacity-60 hover:opacity-100 text-base leading-none"
                  aria-label="Remover"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected.length === 0 && !loadingAll && (
        <div className="rounded-sm border border-border bg-surface p-12 text-center">
          <p className="font-serif text-lg font-semibold text-ink">
            Nenhum Senador selecionado
          </p>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Utilize o campo de busca acima para adicionar pelo menos dois
            Senadores e iniciar a comparação.
          </p>
        </div>
      )}

      {selected.length === 1 && (
        <div className="rounded-sm border-l-4 border-accent bg-panel px-5 py-4">
          <p className="text-sm text-muted">
            Adicione pelo menos mais um Senador para visualizar a comparação.
          </p>
        </div>
      )}

      {selected.length >= 2 && (
        <>
          {/* ============= RADAR ============= */}
          <section>
            <p className="eyebrow">Perfil Multidimensional</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
              Visualização comparada por dimensão
            </h2>
            <p className="mt-2 text-sm text-muted max-w-2xl">
              O gráfico abaixo permite identificar visualmente os pontos
              fortes e fracos de cada parlamentar nas seis dimensões avaliadas.
            </p>
            <div className="mt-5 card">
              <SenadorRadar
                multiData={selected.map((s, i) => ({
                  name: s.nome,
                  color: COLORS[i],
                  data: [
                    { subject: 'Produtividade', value: s.dimProdutividade },
                    { subject: 'Efetividade', value: s.dimEfetividade },
                    { subject: 'Participação', value: s.dimParticipacao },
                    { subject: 'Fiscalização', value: s.dimFiscalizacao },
                    { subject: 'CEAP', value: s.dimCeap },
                    { subject: 'Transparência', value: s.dimTransparencia },
                  ],
                }))}
              />
            </div>
          </section>

          {/* ============= TABELA ============= */}
          <section>
            <p className="eyebrow">Tabela Comparativa</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
              Pontuação detalhada
            </h2>
            <div className="mt-5 overflow-x-auto rounded-sm border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-muted font-semibold">
                      Indicador
                    </th>
                    {selected.map((s, i) => (
                      <th
                        key={s.senadorCod}
                        className="px-4 py-3 text-right text-xs font-semibold"
                        style={{ color: COLORS[i] }}
                      >
                        {s.nome.split(' ').slice(0, 2).join(' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border bg-panel/50">
                    <td className="px-4 py-3 font-serif font-semibold text-ink">
                      IDS Total
                    </td>
                    {selected.map((s) => (
                      <td
                        key={s.senadorCod}
                        className="px-4 py-3 text-right font-mono font-bold text-base text-ink"
                      >
                        {s.idsTotal}
                      </td>
                    ))}
                  </tr>
                  {dims.map((d) => (
                    <tr
                      key={d.key}
                      className="border-b border-border hover:bg-panel/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted">{d.label}</td>
                      {selected.map((s) => {
                        const v = s[d.key as keyof IdsScore] as number
                        return (
                          <td
                            key={s.senadorCod}
                            className="px-4 py-3 text-right font-mono text-ink"
                          >
                            {v}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  <tr className="border-b border-border">
                    <td className="px-4 py-3 text-muted text-xs uppercase tracking-wider">
                      Partido
                    </td>
                    {selected.map((s) => (
                      <td key={s.senadorCod} className="px-4 py-3 text-right text-ink">
                        {s.partido}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-muted text-xs uppercase tracking-wider">
                      UF
                    </td>
                    {selected.map((s) => (
                      <td key={s.senadorCod} className="px-4 py-3 text-right text-ink">
                        {s.uf}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-wrap gap-2 pt-2">
            {selected.map((s, i) => (
              <Link
                key={s.senadorCod}
                href={`/senador?codigo=${s.senadorCod}`}
                className="text-sm rounded-sm border bg-surface px-3 py-1.5 hover:bg-panel transition-colors"
                style={{ borderColor: COLORS[i], color: COLORS[i] }}
              >
                Ver perfil completo de {s.nome.split(' ')[0]} →
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
