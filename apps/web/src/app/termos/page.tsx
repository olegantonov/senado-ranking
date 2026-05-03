import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso — Observatório do Senado',
  description: 'Termos de uso da plataforma Observatório do Senado.',
}

export default function TermosPage() {
  return (
    <article className="prose prose-neutral max-w-3xl mx-auto">
      <p className="eyebrow">Documento legal</p>
      <h1 className="font-serif">Termos de uso</h1>

      <p>
        Os dados apresentados no Observatório do Senado são calculados
        automaticamente a partir de fontes públicas oficiais do Senado
        Federal, processados por código-fonte aberto e disponibilizados sob
        metodologia documentada publicamente.
      </p>

      <h2 className="font-serif">Natureza do indicador</h2>
      <p>
        O Índice de Desempenho Senatorial (IDS) é um indicador quantitativo e
        comparativo de atividade parlamentar mensurável. Ele <strong>não
        representa juízo definitivo</strong> sobre mérito político, qualidade
        moral, ideologia, honestidade, intenção ou relevância substantiva da
        atuação parlamentar.
      </p>

      <h2 className="font-serif">Correções e revisão</h2>
      <p>
        Eventuais erros, divergências ou imprecisões nos dados poderão ser
        comunicados pelos usuários e serão analisados com base em evidências,
        dados oficiais e critérios metodológicos públicos. Solicitações
        podem ser enviadas para{' '}
        <a href="mailto:correcoes@observasenado.org">
          correcoes@observasenado.org
        </a>
        .
      </p>

      <h2 className="font-serif">Independência institucional</h2>
      <p>
        Esta plataforma não possui vínculo institucional com o Senado
        Federal, partidos políticos, mandatos parlamentares, campanhas
        eleitorais ou grupos de interesse.
      </p>

      <h2 className="font-serif">Uso dos dados</h2>
      <p>
        O conteúdo do Observatório do Senado pode ser livremente utilizado,
        citado e republicado para fins jornalísticos, acadêmicos, cívicos e
        educacionais, mediante atribuição da fonte. O código-fonte é aberto e
        está disponível em{' '}
        <a
          href="https://github.com/olegantonov/observatorio-senado"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/olegantonov/observatorio-senado
        </a>
        .
      </p>

      <h2 className="font-serif">Limitação de responsabilidade</h2>
      <p>
        O projeto se compromete com a melhor diligência técnica possível na
        coleta e processamento dos dados, mas não se responsabiliza por
        decisões tomadas exclusivamente com base nas informações aqui
        apresentadas, tampouco por indisponibilidades técnicas decorrentes
        de fontes externas.
      </p>
    </article>
  )
}
