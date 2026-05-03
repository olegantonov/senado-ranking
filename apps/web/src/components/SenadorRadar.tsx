'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

interface RadarDataPoint {
  subject: string
  value: number
  fullMark?: number
}

interface MultiSeries {
  name: string
  color: string
  data: RadarDataPoint[]
}

interface Props {
  /** Single senador mode */
  data?: RadarDataPoint[]
  /** Multi-compare mode */
  multiData?: MultiSeries[]
}

const SINGLE_COLOR = '#1e3a5f'

export default function SenadorRadar({ data, multiData }: Props) {
  if (multiData && multiData.length > 0) {
    // Build unified dataset from first series subjects
    const subjects = multiData[0].data.map((d) => d.subject)
    const chartData = subjects.map((subject) => {
      const row: Record<string, string | number> = { subject }
      for (const series of multiData) {
        const point = series.data.find((d) => d.subject === subject)
        row[series.name] = point?.value ?? 0
      }
      return row
    })

    return (
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#e2dfd8" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#1a1a1a', fontSize: 11, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#8a8e93', fontSize: 9 }}
            stroke="#cdcac2"
          />
          {multiData.map((series) => (
            <Radar
              key={series.name}
              name={series.name}
              dataKey={series.name}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Legend
            formatter={(value) => (
              <span style={{ color: '#1a1a1a', fontSize: 12 }}>{value}</span>
            )}
          />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e2dfd8',
              borderRadius: 4,
              fontSize: 12,
              color: '#1a1a1a',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  if (!data) return null

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#e2dfd8" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#1a1a1a', fontSize: 11, fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#8a8e93', fontSize: 9 }}
          stroke="#cdcac2"
        />
        <Radar
          name="IDS"
          dataKey="value"
          stroke={SINGLE_COLOR}
          fill={SINGLE_COLOR}
          fillOpacity={0.18}
          strokeWidth={2}
          dot={{ fill: SINGLE_COLOR, r: 3 }}
        />
        <Tooltip
          contentStyle={{
            background: '#ffffff',
            border: '1px solid #e2dfd8',
            borderRadius: 4,
            fontSize: 12,
            color: '#1a1a1a',
          }}
          formatter={(v: number) => [`${v} / 100`, 'Score']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
