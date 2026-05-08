import type { Confianca, SenadorStatus } from '@/lib/types'

const STATUS_LABEL: Record<SenadorStatus, { label: string; tone: string; title: string }> = {
  titular_pleno:    { label: 'Titular',           tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    title: 'Titular eleito em exercício pleno na Leg. 57' },
  titular_voltou:   { label: 'Titular (retornou)', tone: 'bg-blue-50 text-blue-800 border-blue-200',
    title: 'Titular que esteve afastado e retornou ao mandato' },
  suplente_efetivo: { label: 'Suplente',          tone: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    title: 'Suplente em exercício consolidado (≥12 meses na Leg. 57)' },
  suplente_recente: { label: 'Suplente recente',  tone: 'bg-amber-50 text-amber-800 border-amber-200',
    title: 'Suplente com menos de 12 meses de exercício na Leg. 57' },
  recente:          { label: 'Recém-empossado',   tone: 'bg-orange-50 text-orange-800 border-orange-200',
    title: 'Em exercício há menos de 6 meses; score regularizado pela média do grupo' },
  afastado:         { label: 'Afastado',          tone: 'bg-rose-50 text-rose-800 border-rose-200',
    title: 'Não exerce o mandato no momento' },
}

const CONFIANCA_LABEL: Record<Confianca, { label: string; title: string; tone: string }> = {
  alta:  { label: 'confiança alta',  tone: 'text-emerald-700', title: 'Score baseado em ≥24 meses de mandato' },
  media: { label: 'confiança média', tone: 'text-amber-700',   title: '12–23 meses de mandato — score levemente regularizado' },
  baixa: { label: 'confiança baixa', tone: 'text-rose-700',    title: '<12 meses — score fortemente regularizado pela média do grupo' },
}

export function StatusBadge({ status }: { status?: SenadorStatus }) {
  if (!status) return null
  const info = STATUS_LABEL[status]
  return (
    <span
      title={info.title}
      className={`inline-flex items-center rounded-sm border px-1.5 py-px text-[10px] uppercase tracking-wider font-medium ${info.tone}`}
    >
      {info.label}
    </span>
  )
}

export function ConfiancaBadge({ confianca }: { confianca?: Confianca }) {
  if (!confianca) return null
  const info = CONFIANCA_LABEL[confianca]
  return (
    <span title={info.title} className={`text-[10px] font-medium ${info.tone}`}>
      {info.label}
    </span>
  )
}
