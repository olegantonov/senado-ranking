import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Observatório do Senado',
  description:
    'Política de privacidade e tratamento de dados pessoais do Observatório do Senado, em conformidade com a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <article className="prose prose-neutral max-w-3xl mx-auto">
      <p className="eyebrow">LGPD · Tratamento de dados</p>
      <h1 className="font-serif">Política de privacidade</h1>

      <p>
        O Observatório do Senado coleta o mínimo necessário de dados para
        funcionamento, segurança, estatísticas técnicas e eventual
        comunicação com apoiadores.
      </p>

      <h2 className="font-serif">Pagamentos e contribuições</h2>
      <p>
        Pagamentos e contribuições são processados por plataformas terceiras.
        Dados financeiros, dados de pagamento, recibos e informações de
        identificação necessárias ao processamento da contribuição são
        tratados pelas respectivas plataformas, conforme suas próprias
        políticas.
      </p>

      <h2 className="font-serif">Dados de navegação</h2>
      <p>
        Para fins técnicos e de segurança, o site pode registrar dados não
        identificáveis como tipo de dispositivo, navegador, país de origem da
        requisição e páginas visitadas. Esses dados são utilizados de forma
        agregada, exclusivamente para manutenção, prevenção a abuso e
        melhoria da plataforma.
      </p>

      <h2 className="font-serif">Compartilhamento</h2>
      <p>
        O Observatório do Senado <strong>não vende dados pessoais</strong> de
        usuários, não comercializa listas de apoiadores e não compartilha
        informações pessoais para fins político-partidários ou eleitorais.
      </p>

      <h2 className="font-serif">Direitos do titular</h2>
      <p>
        Em conformidade com a Lei Geral de Proteção de Dados (Lei nº
        13.709/2018), o titular pode solicitar acesso, correção,
        anonimização, portabilidade ou eliminação de seus dados pessoais.
      </p>
      <p>
        Solicitações relacionadas à privacidade e proteção de dados podem ser
        enviadas para{' '}
        <a href="mailto:privacidade@observasenado.org">
          privacidade@observasenado.org
        </a>
        .
      </p>

      <h2 className="font-serif">Dados públicos parlamentares</h2>
      <p>
        Os dados apresentados sobre Senadores e mandatos têm origem em fontes
        públicas oficiais do Senado Federal, são de interesse público e não
        constituem dados pessoais sob hipóteses de proteção restritiva pela
        LGPD, conforme tratamento aplicável a agentes públicos no exercício
        de suas funções.
      </p>
    </article>
  )
}
