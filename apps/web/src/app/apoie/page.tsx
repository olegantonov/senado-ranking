import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Apoie o Observatório do Senado',
  description:
    'Contribua com a manutenção técnica, infraestrutura e desenvolvimento da plataforma. Iniciativa cidadã independente, transparente e auditável.',
}

const OPEN_COLLECTIVE_URL = 'https://opencollective.com/observatorio-do-senado'

export default function ApoiePage() {
  return (
    <article className="prose prose-neutral max-w-3xl mx-auto">
      <p className="eyebrow">Apoio voluntário · Iniciativa cidadã</p>
      <h1 className="font-serif">Apoie o Observatório do Senado</h1>

      <p className="lead">
        O Observatório do Senado é uma iniciativa cidadã independente, criada
        para ampliar a transparência parlamentar com base em dados públicos,
        metodologia auditável e código-fonte aberto.
      </p>

      <p>
        Sua contribuição ajuda a manter a infraestrutura técnica da plataforma,
        incluindo hospedagem, banco de dados, processamento diário, segurança,
        documentação, auditoria metodológica e desenvolvimento de novas
        funcionalidades.
      </p>

      <p>
        Você pode contribuir publicamente ou optar por não exibir seu nome na
        página de apoiadores, conforme as opções disponíveis na plataforma de
        pagamento. O uso dos recursos será mantido de forma transparente.
      </p>

      <div className="not-prose my-10 rounded-md border border-border bg-panel p-6 text-center">
        <p className="text-sm text-muted mb-4">
          O canal de apoio está em processo de aprovação junto ao{' '}
          <em>fiscal host</em>. Em breve, será possível contribuir diretamente
          pelo Open Collective.
        </p>
        <a
          href={OPEN_COLLECTIVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 text-sm font-medium uppercase tracking-wider text-white hover:bg-primary-hover transition-colors"
        >
          Acompanhar no Open Collective →
        </a>
      </div>

      <h2 className="font-serif">Para que os recursos serão usados</h2>
      <ul>
        <li><strong>Infraestrutura:</strong> hospedagem, banco de dados, CDN, backups</li>
        <li><strong>Dados:</strong> processamento diário e coleta via APIs públicas oficiais</li>
        <li><strong>Segurança:</strong> monitoramento, proteção contra abuso, registros técnicos</li>
        <li><strong>Desenvolvimento:</strong> correções, novas funcionalidades, revisão de código</li>
        <li><strong>Transparência:</strong> documentação, auditoria metodológica, relatórios</li>
        <li><strong>Acessibilidade:</strong> melhorias de interface, responsividade, leitura pública</li>
      </ul>

      <p>
        Não serão utilizados recursos para campanhas eleitorais, promoção de
        candidaturas, impulsionamento político-partidário, remuneração de
        agentes públicos no exercício de suas funções ou favorecimento de
        parlamentares, partidos ou mandatos.
      </p>

      <h2 className="font-serif">Política de contribuições</h2>
      <p>
        O Observatório do Senado poderá receber contribuições de pessoas
        físicas, organizações da sociedade civil, pesquisadores,
        desenvolvedores, jornalistas, empresas e demais apoiadores
        interessados em transparência pública.
      </p>
      <p>
        <strong>
          O apoio financeiro não dá ao doador qualquer direito de interferir
          na metodologia, nos rankings, no código-fonte, nas análises ou nas
          decisões editoriais da plataforma.
        </strong>
      </p>
      <p>
        Para preservar a independência editorial e metodológica, o projeto
        poderá recusar, devolver ou cancelar contribuições que possam gerar
        conflito de interesse, risco reputacional ou aparência de influência
        indevida. Não serão aceitas contribuições condicionadas à alteração
        de ranking, metodologia, resultado individual de parlamentar,
        conteúdo editorial, remoção de dados públicos ou tratamento
        privilegiado a qualquer pessoa, partido, mandato, empresa ou
        organização.
      </p>

      <h2 className="font-serif">Administração financeira</h2>
      <p>
        As contribuições poderão ser processadas por uma plataforma de
        financiamento coletivo com <em>fiscal host</em>, responsável pela
        administração financeira, registros, recibos, conformidade e
        pagamento de despesas aprovadas. O Observatório do Senado não é órgão
        público e não recebe recursos públicos.
      </p>

      <h2 className="font-serif">Perguntas frequentes</h2>

      <h3>O Observatório do Senado é oficial?</h3>
      <p>
        Não. Trata-se de uma iniciativa cidadã independente, sem vínculo
        institucional com o Senado Federal.
      </p>

      <h3>Minha contribuição aparece publicamente?</h3>
      <p>
        O apoiador poderá optar por não exibir seu nome publicamente, conforme
        as opções disponíveis na plataforma de pagamento. A privacidade
        pública não elimina os registros necessários ao processamento
        financeiro e às obrigações legais.
      </p>

      <h3>O doador pode influenciar o ranking?</h3>
      <p>
        Não. Nenhuma contribuição financeira permite interferência na
        metodologia, nos resultados, na ordem do ranking ou na avaliação de
        qualquer parlamentar.
      </p>

      <h3>O projeto tem finalidade eleitoral?</h3>
      <p>
        Não. O projeto não pede voto, não promove candidaturas, não arrecada
        para campanhas e não presta serviço a partidos, mandatos ou
        candidatos.
      </p>

      <p className="text-sm text-muted mt-12">
        Veja também:{' '}
        <Link href="/transparencia">Transparência financeira</Link> ·{' '}
        <Link href="/metodologia">Metodologia</Link> ·{' '}
        <Link href="/termos">Termos de uso</Link>
      </p>
    </article>
  )
}
