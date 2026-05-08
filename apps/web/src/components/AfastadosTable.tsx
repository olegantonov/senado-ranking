import type { SenadorAfastado } from '@/lib/types'

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AfastadosTable({ afastados }: { afastados: SenadorAfastado[] }) {
  if (afastados.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Não há senadores afastados no momento.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-border">
      <table className="w-full text-sm">
        <thead className="bg-panel">
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2 font-medium">Senador</th>
            <th className="px-3 py-2 font-medium">Partido / UF</th>
            <th className="px-3 py-2 font-medium">Motivo</th>
            <th className="px-3 py-2 font-medium">Desde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {afastados.map((a) => (
            <tr key={a.codigo} className="hover:bg-panel/40">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {a.fotoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.fotoUrl}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover bg-border"
                      loading="lazy"
                    />
                  )}
                  <span className="text-ink">{a.nome}</span>
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-muted">
                {a.partido} / {a.uf}
              </td>
              <td className="px-3 py-2 text-muted">{a.motivo}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{formatDate(a.dataInicio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
