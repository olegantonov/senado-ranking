import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Transparência Financeira — Observatório do Senado',
  description:
    'Receitas, despesas e governança da iniciativa. Todas as contribuições e gastos são publicados na plataforma de financiamento utilizada pelo projeto.',
}

export default function TransparenciaPage() {
  return (
    <article className="prose prose-neutral max-w-3xl mx-auto">
      <p className="eyebrow">Governança · Prestação de contas</p>
      <h1 className="font-serif">Transparência financeira</h1>

      <p className="lead">
        Todas as contribuições recebidas e despesas aprovadas serão
        registradas na plataforma de financiamento utilizada pelo projeto,
        permitindo o acompanhamento público da manutenção financeira do
        Observatório do Senado.
      </p>

      <h2 className="font-serif">Categorias de despesa</h2>
      <ul>
        <li>Hospedagem do site e domínio</li>
        <li>Banco de dados e processamento automatizado</li>
        <li>Ferramentas de monitoramento e segurança</li>
        <li>Desenvolvimento de software</li>
        <li>Auditoria metodológica e documentação</li>
        <li>Melhorias de acessibilidade e interface</li>
        <li>Serviços técnicos diretamente relacionados à manutenção da plataforma</li>
      </ul>

      <p>
        Não serão utilizados recursos para campanhas eleitorais, promoção de
        candidaturas, impulsionamento político-partidário, remuneração de
        agentes públicos no exercício de suas funções ou favorecimento de
        parlamentares, partidos ou mandatos.
      </p>

      <h2 className="font-serif">Independência editorial</h2>
      <p>
        O Observatório do Senado é uma plataforma independente. Nenhum
        apoiador, doador, parceiro técnico ou prestador de serviço possui
        controle sobre os resultados do IDS, sobre a ordem do ranking, sobre
        a metodologia de cálculo ou sobre a seleção dos dados utilizados.
      </p>
      <p>
        A metodologia é pública, o código-fonte é aberto e os dados
        utilizados são provenientes de fontes oficiais e auditáveis.
      </p>

      <h2 className="font-serif">Acompanhamento público</h2>
      <p>
        Em breve, esta página exibirá automaticamente o saldo, as
        contribuições e as despesas registradas no Open Collective. Enquanto
        a aprovação junto ao <em>fiscal host</em> está em processo, o canal
        de apoio pode ser acompanhado em:
      </p>
      <p>
        <a
          href="https://opencollective.com/observatorio-do-senado"
          target="_blank"
          rel="noopener noreferrer"
        >
          opencollective.com/observatorio-do-senado
        </a>
      </p>

      <p className="text-sm text-muted mt-12">
        Veja também:{' '}
        <Link href="/apoie">Apoie o projeto</Link> ·{' '}
        <Link href="/metodologia">Metodologia</Link>
      </p>
    </article>
  )
}
