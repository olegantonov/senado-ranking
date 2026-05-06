'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSenador, getCeap } from '@/lib/api'
import type { IdsScore, CeapResponse } from '@/lib/types'
import SenadorRadar from '@/components/SenadorRadar'
import CeapBarChart from '@/components/CeapBarChart'

function idsClass(v: number) {
  if (v >= 75) return 'text-[#14532d]'
  if (v >= 55) return 'text-[#1e7d4a]'
  if (v >= 40) return 'text-[#92742a]'
  if (v >= 25) return 'text-[#9b6608]'
  return 'text-[#9b2c2c]'
}

function idsLabel(v: number) {
  if (v >= 75) return 'Excelente'
  if (v >= 55) return 'Bom'
  if (v >= 40) return 'Médio'
  if (v >= 25) return 'Abaixo da média'
  return 'Crítico'
}

function DimBar({
  label,
  value,
  description,
  weight,
}: {
  label: string
  value: number
  description: string
  weight: string
}) {
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
    <div className="space-y-1.5 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex justify-between items-baseline gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{label}</div>
          <div className="text-xs text-muted">
            {description} · peso {weight}
          </div>
        </div>
        <span className="font-mono font-bold text-base text-ink">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

const CEAP_ANOS = [2023, 2024, 2025, 2026]

function SenadorContent() {
  const params = useSearchParams()
  const codigo = params.get('codigo') ?? ''
  const [data, setData] = useState<IdsScore | null>(null)
  const [ceapPorAno, setCeapPorAno] = useState<Record<number, CeapResponse['meses']>>({})
  const [ceapAno, setCeapAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!codigo) {
      setError('Código do Senador não informado.')
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      getSenador(codigo),
      ...CEAP_ANOS.map((ano) => getCeap(codigo, ano).catch(() => null)),
    ])
      .then(([s, ...ceapResults]) => {
        setData(s as IdsScore)
        const porAno: Record<number, CeapResponse['meses']> = {}
        CEAP_ANOS.forEach((ano, i) => {
          const r = ceapResults[i] as CeapResponse | null
          if (r?.meses?.length) porAno[ano] = r.meses
        })
        setCeapPorAno(porAno)
      })
      .catch(() => setError('Não foi possível carregar os dados deste Senador.'))
      .finally(() => setLoading(false))
  }, [codigo])

  if (loading)
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent" />
      </div>
    )

  if (error || !data)
    return (
      <div className="rounded-sm border border-border bg-surface p-10 text-center">
        <p className="font-serif text-lg font-semibold text-ink">
          Senador não localizado
        </p>
        <p className="mt-2 text-sm text-muted">{error ?? 'Verifique o código.'}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          ← Voltar ao ranking
        </Link>
      </div>
    )

  return (
    <div className="space-y-10 fade-in">
      <Link
        href="/"
        className="text-sm text-muted hover:text-primary transition-colors inline-flex items-center gap-1"
      >
        ← Voltar ao ranking completo
      </Link>

      {/* ============= HEADER PERFIL ============= */}
      <header className="flex flex-col md:flex-row gap-8 md:items-center border-b border-border pb-8">
        <div className="flex items-center gap-5 flex-1">
          {data.fotoUrl ? (
            <img
              src={data.fotoUrl}
              alt={data.nome}
              className="w-24 h-24 rounded-sm object-cover border border-border flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-sm bg-border flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="eyebrow">Perfil Parlamentar</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-ink leading-tight">
              {data.nome}
            </h1>
            <p className="mt-2 text-sm text-muted">
              <span className="font-medium text-ink">{data.partido}</span> ·{' '}
              {data.uf}
              {data.bloco && <span className="block text-xs mt-0.5">{data.bloco}</span>}
            </p>
            {data.dataInicioExercicio && (
              <p className="text-xs text-muted mt-2">
                Em exercício desde{' '}
                {new Date(data.dataInicioExercicio).toLocaleDateString('pt-BR')}
                {data.mesesAtivos !== undefined &&
                  ` · ${data.mesesAtivos} meses ativos`}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {data.imovelFuncional && (
                <span className="text-xs rounded-sm border border-border bg-panel px-2 py-1 text-muted">
                  Imóvel funcional
                </span>
              )}
              {data.auxilioMoradia && (
                <span className="text-xs rounded-sm border border-accent/30 bg-accent/10 px-2 py-1 text-accent">
                  Auxílio-moradia
                </span>
              )}
              {data.cargosTitulos && data.cargosTitulos.length > 0 &&
                data.cargosTitulos.slice(0, 3).map((cargo, i) => (
                  <span
                    key={i}
                    className="text-xs rounded-sm border border-primary/30 bg-primary/5 px-2 py-1 text-primary font-medium"
                    title={cargo}
                  >
                    {cargo.length > 50 ? cargo.slice(0, 47) + '…' : cargo}
                  </span>
                ))}
            </div>
          </div>
        </div>

        <div className="md:border-l md:border-border md:pl-8 text-center">
          <p className="eyebrow">IDS</p>
          <div className={`mt-1 font-serif text-6xl font-bold ${idsClass(data.idsTotal)}`}>
            {data.idsTotal}
          </div>
          <p className="mt-1 text-sm text-muted">
            {idsLabel(data.idsTotal)}
          </p>
        </div>
      </header>

      {/* ============= INDICADORES BRUTOS ============= */}
      <section>
        <p className="eyebrow">Indicadores Brutos · 57ª Legislatura</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
          Atividade parlamentar acumulada
        </h2>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Valores absolutos registrados desde o início do mandato. Para o
          cálculo do IDS, esses números são normalizados pelo número de meses
          em exercício antes da padronização estatística.
        </p>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border rounded-sm overflow-hidden">
          <RawStat label="Autorias apresentadas" value={data.autoriasTotal} />
          <RawStat label="Autorias aprovadas" value={data.autoriasAprovadas} />
          <RawStat
            label="Presença em votações (plenário)"
            value={`${data.votacaoPresentes}/${data.votacoesTotal}`}
          />
          <RawStat
            label="Presença em votações (comissão)"
            value={`${data.votacoesComissaoPresentes ?? 0}/${data.votacoesComissaoTotal ?? 0}`}
          />
          <RawStat label="Relatorias assumidas" value={data.relatoriasTotal} />
          <RawStat label="Discursos em plenário" value={data.discursosTotal} />
          <RawStat label="Apartes" value={data.apartesTotal} />
          <RawStat
            label="Cargos de liderança"
            value={data.cargosLideranca ?? 0}
          />
          <RawStat
            label="CEAP acumulada"
            value={(data.ceapTotalAno || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0,
            })}
          />
          <RawStat
            label="% gasto em divulgação"
            value={`${(data.pctDivulgacao ?? 0).toFixed(1)}%`}
          />
          <RawStat
            label="Escritórios de apoio"
            value={data.escritoriosCount ?? 0}
          />
        </div>

        {(data.ceapDivulgacao || data.ceapEscritorio || data.ceapLocomocao) ? (
          <div className="mt-6 card">
            <h3 className="font-serif text-base font-semibold text-ink mb-3">
              Composição da cota parlamentar (CEAP)
            </h3>
            <ul className="text-sm space-y-1">
              {[
                ['Divulgação da atividade', data.ceapDivulgacao],
                ['Escritório (aluguel/material)', data.ceapEscritorio],
                ['Locomoção (passagens/combustível)', data.ceapLocomocao],
                ['Consultoria/Assessoria', data.ceapConsultoria],
                ['Outros', data.ceapOutros],
              ].filter(([, v]) => (v as number) > 0).map(([label, valor]) => (
                <li key={label as string} className="flex justify-between border-b border-border/40 pb-1">
                  <span className="text-muted">{label}</span>
                  <span className="font-mono text-ink">
                    {(valor as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Quando o gasto em “Divulgação” é desproporcional ao total, a dimensão CEAP é penalizada por indicar autopromoção em vez de atividade legislativa.
            </p>
          </div>
        ) : null}
      </section>

      {/* ============= DIMENSÕES IDS ============= */}
      <section>
        <p className="eyebrow">Decomposição do IDS</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
          Desempenho por dimensão
        </h2>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Cada dimensão é normalizada na escala 0–100 a partir da posição
          relativa do Senador na distribuição do conjunto. Score 50 representa
          o desempenho mediano do grupo avaliado.
        </p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-serif text-lg font-semibold text-ink mb-4">
              Perfil multidimensional
            </h3>
            <SenadorRadar
              data={[
                { subject: 'Produtividade', value: data.dimProdutividade, fullMark: 100 },
                { subject: 'Efetividade', value: data.dimEfetividade, fullMark: 100 },
                { subject: 'Participação', value: data.dimParticipacao, fullMark: 100 },
                { subject: 'Fiscalização', value: data.dimFiscalizacao, fullMark: 100 },
                { subject: 'CEAP', value: data.dimCeap, fullMark: 100 },
                { subject: 'Transparência', value: data.dimTransparencia, fullMark: 100 },
              ]}
            />
          </div>
          <div className="card space-y-4">
            <h3 className="font-serif text-lg font-semibold text-ink">
              Pontuação detalhada
            </h3>
            <DimBar
              label="Produtividade Legislativa"
              value={data.dimProdutividade}
              description="Pontos ponderados por tipo (PEC×3, PL×1.5, Req×0.4) por mês"
              weight="20%"
            />
            <DimBar
              label="Efetividade"
              value={data.dimEfetividade}
              description="Status real: lei×3, aprovado SF×1.5, em tramitação×0.5"
              weight="24%"
            />
            <DimBar
              label="Participação"
              value={data.dimParticipacao}
              description="Presença em votações nominais"
              weight="20%"
            />
            <DimBar
              label="Fiscalização"
              value={data.dimFiscalizacao}
              description="Relatorias por mês, ajustada por cargos de liderança"
              weight="13%"
            />
            <DimBar
              label="Eficiência CEAP"
              value={data.dimCeap}
              description="Gasto mensal (escala invertida)"
              weight="11%"
            />
            <DimBar
              label="Transparência & Debate"
              value={data.dimTransparencia}
              description="Discursos + 0.5×apartes por mês"
              weight="12%"
            />
          </div>
        </div>
      </section>

      {/* ============= CARGOS EXERCIDOS ============= */}
      {data.cargosTitulos && data.cargosTitulos.length > 0 && (
        <section>
          <p className="eyebrow">Cargos Exercidos</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
            Lideranças e funções ativas
          </h2>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Cargos de liderança partidária, presidências de comissão e
            assentos na Mesa Diretora atualmente exercidos pelo parlamentar.
            Estes cargos são considerados no cálculo da dimensão
            Fiscalização, com fator de ajuste para neutralizar viés estrutural
            na distribuição de relatorias.
          </p>
          <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.cargosTitulos.map((cargo, i) => (
              <li
                key={i}
                className="text-sm rounded-sm border border-border bg-surface px-4 py-3 text-ink"
              >
                <span className="text-primary mr-2">▪</span>
                {cargo}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ============= CEAP ============= */}
      {Object.keys(ceapPorAno).length > 0 && (
        <section>
          <p className="eyebrow">Cota Parlamentar (CEAP)</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold text-ink">
            Despesas mensais — {ceapAno}
          </h2>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            A Cota para o Exercício da Atividade Parlamentar dos Senadores
            (CEAP) é o orçamento destinado a despesas relacionadas ao mandato.
            Os valores abaixo refletem reembolsos efetivamente realizados.
          </p>
          <div className="mt-5 card">
            <div className="flex gap-1 mb-4">
              {CEAP_ANOS.filter((ano) => ceapPorAno[ano]?.length).map((ano) => (
                <button
                  key={ano}
                  onClick={() => setCeapAno(ano)}
                  className={`px-3 py-1 text-sm rounded-sm border transition-colors ${
                    ceapAno === ano
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-muted hover:border-primary hover:text-primary'
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>
            <CeapBarChart meses={ceapPorAno[ceapAno] ?? []} />
          </div>
        </section>
      )}
    </div>
  )
}

function RawStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="bg-surface px-4 py-4">
      <p className="text-[11px] uppercase tracking-wider text-muted font-medium">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-semibold text-ink">{value}</p>
    </div>
  )
}

export default function SenadorPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent" />
        </div>
      }
    >
      <SenadorContent />
    </Suspense>
  )
}
