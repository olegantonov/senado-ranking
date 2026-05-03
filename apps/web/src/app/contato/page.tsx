import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contato — Observatório do Senado',
  description:
    'Canais de contato, correções de dados, imprensa e questões de privacidade.',
}

const CONTATOS = [
  {
    titulo: 'Geral',
    email: 'contato@observasenado.org',
    descricao: 'Dúvidas, parcerias e contato institucional.',
  },
  {
    titulo: 'Correções de dados',
    email: 'correcoes@observasenado.org',
    descricao:
      'Comunicação de erros, imprecisões ou divergências em dados de Senadores. Inclua referência à fonte oficial.',
  },
  {
    titulo: 'Metodologia',
    email: 'metodologia@observasenado.org',
    descricao:
      'Auditoria, sugestões metodológicas e questionamentos técnicos sobre o cálculo do IDS.',
  },
  {
    titulo: 'Imprensa',
    email: 'imprensa@observasenado.org',
    descricao: 'Solicitações de jornalistas e veículos de comunicação.',
  },
  {
    titulo: 'Apoio',
    email: 'apoio@observasenado.org',
    descricao:
      'Dúvidas sobre contribuições, Open Collective e prestação de contas.',
  },
  {
    titulo: 'Privacidade (LGPD)',
    email: 'privacidade@observasenado.org',
    descricao:
      'Solicitações relacionadas a dados pessoais e direitos do titular.',
  },
]

export default function ContatoPage() {
  return (
    <article className="prose prose-neutral max-w-3xl mx-auto">
      <p className="eyebrow">Contato</p>
      <h1 className="font-serif">Fale com o Observatório</h1>

      <p className="lead">
        Use o canal mais apropriado para o seu assunto. Damos prioridade a
        correções fundamentadas em dados oficiais.
      </p>

      <div className="not-prose mt-8 grid gap-4 sm:grid-cols-2">
        {CONTATOS.map((c) => (
          <div
            key={c.email}
            className="rounded-sm border border-border bg-surface p-5"
          >
            <h3 className="font-serif text-lg font-semibold text-ink">
              {c.titulo}
            </h3>
            <a
              href={`mailto:${c.email}`}
              className="mt-1 block text-sm text-primary hover:text-accent transition-colors"
            >
              {c.email}
            </a>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              {c.descricao}
            </p>
          </div>
        ))}
      </div>
    </article>
  )
}
