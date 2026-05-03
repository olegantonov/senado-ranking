import type { Metadata } from 'next'
import NewsletterForm from '@/components/NewsletterForm'

export const metadata: Metadata = {
  title: 'Newsletter — Observatório do Senado',
  description:
    'Receba atualizações periódicas sobre monitoramento parlamentar, mudanças metodológicas e novas funcionalidades.',
}

export default function NewsletterPage() {
  return (
    <article className="prose prose-neutral max-w-3xl mx-auto">
      <p className="eyebrow">Atualizações periódicas</p>
      <h1 className="font-serif">Newsletter do Observatório</h1>
      <p className="lead">
        Receba periodicamente, no seu e-mail, atualizações do ranking, mudanças
        metodológicas e novas funcionalidades. Conteúdo curto, técnico e sem
        viés partidário.
      </p>

      <div className="not-prose my-8">
        <NewsletterForm />
      </div>

      <h2 className="font-serif">O que esperar</h2>
      <ul>
        <li>Resumos periódicos das alterações no IDS</li>
        <li>Notas sobre dados, fontes e correções</li>
        <li>Convites para auditorias metodológicas e contribuições técnicas</li>
        <li>Anúncios de novas dimensões e funcionalidades da plataforma</li>
      </ul>

      <h2 className="font-serif">Política e privacidade</h2>
      <p>
        Utilizamos um fluxo de <strong>confirmação dupla</strong> (double
        opt-in) — você só passa a receber e-mails após clicar no link de
        confirmação enviado para o endereço fornecido. Cada e-mail enviado
        possui um link individual de cancelamento. Não compartilhamos sua
        lista com terceiros e não usamos os endereços para qualquer
        finalidade político-partidária ou eleitoral.
      </p>
      <p className="text-sm text-muted">
        Saiba mais em <a href="/privacidade">Política de Privacidade</a>.
      </p>
    </article>
  )
}
