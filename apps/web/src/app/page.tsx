'use client'

import { useEffect, useState } from 'react'
import { getRanking, getRankingMeta } from '@/lib/api'
import type { IdsScore, MetaResponse, SortKey, SortDir } from '@/lib/types'
import RankingTable from '@/components/RankingTable'
import FilterBar from '@/components/FilterBar'
import NewsletterForm from '@/components/NewsletterForm'

export default function HomePage() {
  const [scores, setScores] = useState<IdsScore[]>([])
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('idsTotal')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [partido, setPartido] = useState('')
  const [uf, setUf] = useState('')
  const [bloco, setBloco] = useState('')

  useEffect(() => {
    getRankingMeta().then(setMeta).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    getRanking({
      partido: partido || undefined,
      uf: uf || undefined,
      bloco: bloco || undefined,
    })
      .then((r) => setScores(r.data))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [partido, uf, bloco])

  const sorted = [...scores].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc'
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number)
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-12 fade-in">
      {/* ============= ABERTURA INSTITUCIONAL ============= */}
      <section className="border-b border-border pb-10">
        <p className="eyebrow">Avaliação Parlamentar · 57ª Legislatura</p>
        <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-ink">
          Ranking dos Senadores da República
        </h1>
        <p className="mt-5 max-w-3xl text-base sm:text-lg leading-relaxed text-muted">
          O <strong className="text-ink">Índice de Desempenho Senatorial (IDS)</strong>{' '}
          é um indicador composto que sintetiza, em uma única nota de 0 a 100,
          a atividade parlamentar mensurável de cada Senador em exercício. A
          metodologia agrega seis dimensões — produtividade, efetividade,
          participação em votações, fiscalização, eficiência no uso da cota
          parlamentar e transparência — todas extraídas das bases públicas
          oficiais do Senado Federal.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
          Os dados são reprocessados diariamente. A janela analítica cobre toda
          a 57ª Legislatura, iniciada em 1º de fevereiro de 2023, com
          normalização por meses ativos no mandato para garantir comparabilidade
          entre titulares e suplentes que assumiram em momentos distintos.
        </p>
      </section>

      {/* ============= INDICADORES SÍNTESE ============= */}
      {!loading && scores.length > 0 && (
        <section>
          <p className="eyebrow mb-4">Panorama Geral</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded-sm overflow-hidden">
            <StatCard label="Senadores avaliados" value={scores.length} suffix="" />
            <StatCard
              label="IDS médio"
              value={Math.round(
                scores.reduce((s, x) => s + x.idsTotal, 0) / scores.length,
              )}
            />
            <StatCard
              label="Maior IDS"
              value={Math.max(...scores.map((s) => s.idsTotal))}
              highlight
            />
            <StatCard
              label="Menor IDS"
              value={Math.min(...scores.map((s) => s.idsTotal))}
            />
          </div>
        </section>
      )}

      {/* ============= NOTA DE LEITURA ============= */}
      <section className="rounded-sm border-l-4 border-accent bg-panel px-5 py-4">
        <p className="eyebrow text-accent">Nota de leitura</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          O IDS é um indicador <strong className="text-ink">quantitativo</strong>{' '}
          de atividade parlamentar e não constitui julgamento sobre o mérito ou
          a qualidade do trabalho legislativo. Cargos de liderança, presidências
          de comissão e relatorias especiais tendem a inflar naturalmente certas
          dimensões. Recomenda-se sempre consultar o perfil individual e a{' '}
          <a
            href="/metodologia"
            className="text-primary underline-offset-2 hover:underline"
          >
            página de metodologia
          </a>{' '}
          para uma interpretação adequada dos resultados.
        </p>
      </section>

      {/* ============= RANKING ============= */}
      <section className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="eyebrow">Ranking Completo</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
              Classificação por Índice de Desempenho Senatorial
            </h2>
            <p className="mt-1 text-sm text-muted">
              Clique em qualquer coluna para reordenar. Use os filtros abaixo
              para segmentar por partido, unidade federativa ou bloco
              parlamentar.
            </p>
          </div>
        </header>

        {meta && (
          <FilterBar
            meta={meta}
            partido={partido}
            uf={uf}
            bloco={bloco}
            onPartido={setPartido}
            onUf={setUf}
            onBloco={setBloco}
            onClear={() => {
              setPartido('')
              setUf('')
              setBloco('')
            }}
          />
        )}

        {error ? (
          <EmptyState
            title="Ranking em preparação"
            description="Os dados estão sendo processados pelo sistema. O cálculo completo é realizado uma vez por dia. Por favor, retorne em alguns minutos."
            detail={error}
          />
        ) : loading ? (
          <LoadingState />
        ) : scores.length === 0 ? (
          <EmptyState
            title="Nenhum senador encontrado"
            description="Os filtros aplicados não retornaram resultados. Tente ampliar os critérios de busca."
          />
        ) : (
          <RankingTable
            scores={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </section>

      {/* ============= COMO INTERPRETAR ============= */}
      <section className="border-t border-border pt-10">
        <p className="eyebrow">Como interpretar o IDS</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-ink">
          Faixas de classificação
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          A pontuação final, normalizada de 0 a 100, segue uma distribuição
          normal padronizada (z-score → CDF). Um score de 50 representa o
          desempenho mediano do conjunto avaliado.
        </p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-5 gap-px bg-border border border-border rounded-sm overflow-hidden">
          <Faixa nome="Excelente" range="≥ 75" cor="#14532d" desc="Acima de um desvio-padrão" />
          <Faixa nome="Bom" range="55 – 74" cor="#1e7d4a" desc="Acima da média" />
          <Faixa nome="Médio" range="40 – 54" cor="#92742a" desc="Em torno da média" />
          <Faixa nome="Abaixo" range="25 – 39" cor="#9b6608" desc="Abaixo da média" />
          <Faixa nome="Crítico" range="< 25" cor="#9b2c2c" desc="Mais de um desvio-padrão abaixo" />
        </div>
      </section>

      {/* ============= APOIE / INDEPENDÊNCIA ============= */}
      <section className="border-t border-border pt-10">
        <div className="rounded-sm border border-border bg-panel px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow">Iniciativa cidadã independente</p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-ink">
              Ajude a manter o Observatório do Senado
            </h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              O IDS é mantido com dados públicos, código aberto e metodologia
              auditável. Sua contribuição ajuda a custear infraestrutura,
              processamento de dados e melhorias da plataforma. Apoiadores
              <strong className="text-ink"> não influenciam</strong> a metodologia,
              o ranking ou as decisões editoriais.
            </p>
          </div>
          <a
            href="/apoie"
            className="mt-4 sm:mt-0 inline-flex shrink-0 items-center justify-center rounded-sm bg-primary px-5 py-3 text-xs font-medium uppercase tracking-wider text-white hover:bg-primary-hover transition-colors"
          >
            Apoiar o projeto →
          </a>
        </div>
      </section>

      {/* ============= NEWSLETTER ============= */}
      <section className="border-t border-border pt-10">
        <NewsletterForm />
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string
  value: number
  suffix?: string
  highlight?: boolean
}) {
  return (
    <div className="bg-surface px-5 py-5">
      <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
        {label}
      </p>
      <p
        className={`mt-2 font-serif text-3xl font-semibold ${
          highlight ? 'text-accent' : 'text-ink'
        }`}
      >
        {value}
        {suffix}
      </p>
    </div>
  )
}

function Faixa({
  nome,
  range,
  cor,
  desc,
}: {
  nome: string
  range: string
  cor: string
  desc: string
}) {
  return (
    <div className="bg-surface px-4 py-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: cor }}
        />
        <span className="font-semibold text-sm text-ink">{nome}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted">{range}</p>
      <p className="mt-1 text-xs text-muted leading-snug">{desc}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-sm bg-surface border border-border animate-pulse"
          style={{ opacity: 1 - i * 0.06 }}
        />
      ))}
    </div>
  )
}

function EmptyState({
  title,
  description,
  detail,
}: {
  title: string
  description: string
  detail?: string
}) {
  return (
    <div className="rounded-sm border border-border bg-surface p-10 text-center">
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      {detail && (
        <p className="mt-4 font-mono text-[11px] text-subtle">{detail}</p>
      )}
    </div>
  )
}
