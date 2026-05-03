'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { CeapMes } from '@/lib/types'

const MONTH_LABELS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

interface Props {
  meses: CeapMes[]
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export default function CeapBarChart({ meses }: Props) {
  const data = meses.map((m) => ({
    mes: MONTH_LABELS[m.mes - 1] ?? String(m.mes),
    valor: m.valorTotal,
  }))

  const max = Math.max(...data.map((d) => d.valor))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
        barSize={24}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2dfd8" vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fill: '#5b6166', fontSize: 11 }}
          axisLine={{ stroke: '#cdcac2' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          tick={{ fill: '#5b6166', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e2dfd8',
            borderRadius: 4,
            fontSize: 12,
            color: '#1a1a1a',
          }}
          formatter={(v: number) => [formatBRL(v), 'CEAP']}
          cursor={{ fill: 'rgba(30,58,95,0.06)' }}
        />
        <Bar dataKey="valor" radius={[2, 2, 0, 0]}>
          {data.map((entry, i) => {
            // gradient azul institucional → dourado conforme valor
            const ratio = max > 0 ? entry.valor / max : 0
            const r = Math.round(30 + ratio * (184 - 30))
            const g = Math.round(58 + ratio * (134 - 58))
            const b = Math.round(95 - ratio * 84)
            return <Cell key={i} fill={`rgb(${r},${g},${b})`} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
