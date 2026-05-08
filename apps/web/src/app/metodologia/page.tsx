export default function MetodologiaPage() {
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">Documentação Técnica · IDS v3</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-ink">
        Metodologia do Índice de Desempenho Senatorial
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Esta página descreve, de forma transparente e auditável, como o IDS é
        construído. O objetivo é permitir que pesquisadores, jornalistas,
        cidadãos e os próprios parlamentares possam compreender, replicar e
        questionar o cálculo. Todo o código-fonte está publicado em repositório
        aberto.
      </p>

      <div className="mt-6 rounded-sm border-l-4 border-accent bg-panel px-5 py-4">
        <p className="eyebrow">Atualização — Maio de 2026 (v3)</p>
        <p className="mt-1 text-sm text-ink leading-relaxed">
          A versão 3 introduz <strong>regularização Bayesiana (shrinkage)</strong>:
          cada dimensão é ajustada em função do tempo efetivo de exercício na
          Leg. 57, fazendo com que parlamentares com mandato curto (suplentes
          recém-empossados, titulares que retornaram após licença) sejam
          comparáveis aos titulares plenos sem sofrer distorção por amostra
          pequena. A v3 também adiciona o conceito de{' '}
          <strong>status do parlamentar</strong> (titular pleno, titular
          retornado, suplente efetivo, suplente recente, recém-empossado,
          afastado) e permite filtrar o ranking por cada categoria. Senadores
          afastados aparecem em aba dedicada — fora do ranking principal,
          mas com identificação clara do motivo e da data do afastamento.
        </p>
      </div>

      <div className="mt-4 rounded-sm border border-border bg-surface px-5 py-4">
        <p className="eyebrow">Como o shrinkage funciona</p>
        <p className="mt-2 text-sm text-ink leading-relaxed">
          Para cada dimensão (taxa = numerador / mesesAtivos), calculamos:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-sm bg-panel px-3 py-2 font-mono text-xs text-ink">
{`taxa_ajustada = (numerador + media_grupo × K) / (mesesAtivos + K)
K = 12  // 1 ano legislativo`}
        </pre>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Quem tem ≥30 meses fica praticamente idêntico ao bruto; quem tem 1
          mês fica próximo da média do grupo. A constante K = 12 foi calibrada
          por simulação sobre os 80 senadores em exercício, comparando K ∈
          {' {6, 12, 18, 24}'} — K = 12 oferece o melhor equilíbrio entre
          neutralizar amostras pequenas e preservar diferenciação para mandatos
          consolidados. O valor bruto (sem shrinkage) também é gravado em{' '}
          <code>idsTotalBruto</code> para auditoria.
        </p>
      </div>

      <hr className="divider-rule my-10" />

      <article className="prose prose-institucional max-w-none">
        <h2>1. Objeto e propósito</h2>
        <p>
          O <strong>Índice de Desempenho Senatorial (IDS)</strong> é um
          indicador composto que sintetiza, em uma escala única de 0 a 100, a
          atividade parlamentar mensurável dos Senadores em exercício. Ele
          combina seis dimensões complementares, ponderadas conforme sua
          relevância para o trabalho legislativo, e produz um <em>ranking</em>{' '}
          comparativo de todos os parlamentares ativos da legislatura corrente.
        </p>

        <h2>2. Janela temporal</h2>
        <p>
          A análise cobre integralmente a <strong>57ª Legislatura</strong>, com
          início em 1º de fevereiro de 2023 e término previsto em 31 de janeiro
          de 2027. Para cada Senador, todos os indicadores brutos — autorias,
          relatorias, discursos, apartes, votações e gastos com cota parlamentar
          — são acumulados ao longo dessa janela.
        </p>

        <h2>3. Normalização por meses ativos</h2>
        <p>
          A composição do Senado contempla titulares e suplentes que podem
          assumir o mandato em momentos distintos. Para garantir
          comparabilidade, todos os indicadores cumulativos são divididos pelo{' '}
          <strong>número de meses efetivamente em exercício</strong> antes da
          padronização estatística. As dimensões <strong>Efetividade</strong> e{' '}
          <strong>Participação</strong> já são razões e dispensam normalização
          temporal adicional.
        </p>

        <h2>4. Ponderação por tipo de proposição (Produtividade)</h2>
        <p>
          Nem toda proposição exige o mesmo grau de elaboração ou produz o
          mesmo impacto normativo. Em vez de tratar todas igualmente, o IDS
          atribui pesos distintos:
        </p>
        <table>
          <thead>
            <tr>
              <th>Tipo de proposição</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Proposta de Emenda à Constituição (PEC)</td>
              <td>3,0</td>
            </tr>
            <tr>
              <td>Projeto de Lei Complementar (PLP)</td>
              <td>2,0</td>
            </tr>
            <tr>
              <td>Projeto de Lei (PL/PLN)</td>
              <td>1,5</td>
            </tr>
            <tr>
              <td>Projeto de Decreto Legislativo (PDL/PDS)</td>
              <td>1,2</td>
            </tr>
            <tr>
              <td>Projeto de Resolução / Medida Provisória</td>
              <td>1,0</td>
            </tr>
            <tr>
              <td>Requerimento (RQS/RQN/REQ)</td>
              <td>0,4</td>
            </tr>
            <tr>
              <td>Indicação (INC/IND)</td>
              <td>0,2</td>
            </tr>
          </tbody>
        </table>
        <p>
          A <strong>produtividade ponderada</strong> de cada Senador é a soma
          desses pesos, dividida pelos meses ativos.
        </p>

        <h2>5. Classificação de status (Efetividade)</h2>
        <p>
          Aprovar um requerimento de voto de pesar não é equivalente a
          transformar um Projeto de Lei em norma sancionada. A dimensão de
          Efetividade pondera o desfecho real de cada autoria:
        </p>
        <ul>
          <li>
            <strong>Lei sancionada / promulgada</strong> — peso 3,0
          </li>
          <li>
            <strong>Aprovada no Senado</strong> (mesmo aguardando outra Casa) —
            peso 1,5
          </li>
          <li>
            <strong>Em tramitação avançada</strong> (comissão de mérito ou
            plenário) — peso 0,5
          </li>
          <li>
            Arquivada, prejudicada ou retirada — peso 0
          </li>
        </ul>
        <p>
          O score de Efetividade é a razão entre o somatório (status × peso do
          tipo) e o somatório dos pesos das proposições apresentadas.
        </p>

        <h2>6. Ajuste por cargos de liderança (Fiscalização)</h2>
        <p>
          Relatorias são distribuídas predominantemente pela presidência das
          comissões. Líderes partidários, presidentes de comissão e membros da
          Mesa Diretora tendem a acumular relatorias por força do cargo, não
          por mérito legislativo. Para neutralizar esse viés estrutural, a
          dimensão de Fiscalização aplica um fator de ajuste:
        </p>
        <pre>
{`fiscalização = (relatorias / meses ativos) × 1 / (1 + 0,3 · cargos)`}
        </pre>
        <p>
          Onde <code>cargos</code> é o número de funções de liderança ativas.
          Um Senador com uma presidência de comissão tem o score multiplicado
          por aproximadamente 0,77; com duas funções, por 0,63.
        </p>

        <h2>7. Padronização estatística</h2>
        <p>
          Cada vetor de indicadores é convertido em um percentil de 0 a 100 por
          meio do método <strong>z-score → CDF normal</strong>. Para cada
          dimensão calcula-se a média e o desvio-padrão da distribuição, e cada
          Senador recebe uma pontuação proporcional à sua posição relativa:
        </p>
        <ul>
          <li>
            <strong>Score 50</strong> → desempenho na mediana do conjunto
          </li>
          <li>
            <strong>Score 84</strong> → um desvio-padrão acima da média
          </li>
          <li>
            <strong>Score 97</strong> → dois desvios-padrão acima da média
          </li>
        </ul>

        <h2>8. Dimensões e pesos finais</h2>
        <table>
          <thead>
            <tr>
              <th>Dimensão</th>
              <th>Peso</th>
              <th>O que mede</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Produtividade Legislativa</td>
              <td>20%</td>
              <td>Pontos ponderados por tipo de proposição, por mês ativo</td>
            </tr>
            <tr>
              <td>Efetividade</td>
              <td>24%</td>
              <td>Status real das autorias (lei × aprovado × tramitando)</td>
            </tr>
            <tr>
              <td>Participação</td>
              <td>20%</td>
              <td>Presença em votações nominais</td>
            </tr>
            <tr>
              <td>Fiscalização</td>
              <td>13%</td>
              <td>Relatorias por mês, ajustadas por cargos de liderança</td>
            </tr>
            <tr>
              <td>Eficiência CEAP</td>
              <td>11%</td>
              <td>Gasto mensal com cota parlamentar (escala invertida)</td>
            </tr>
            <tr>
              <td>Transparência &amp; Debate</td>
              <td>12%</td>
              <td>Discursos + 50% dos apartes parlamentares, por mês</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted">
          Total: 100%. Os pesos foram calibrados por análise crítica dos
          principais índices acadêmicos de desempenho parlamentar (Atlas
          Político, FGV-CEPESP) e podem ser revisados em futuras versões.
        </p>

        <h2>9. Fórmula de agregação</h2>
        <pre>
{`IDS = 0,20 · Produtividade
    + 0,24 · Efetividade
    + 0,20 · Participação
    + 0,13 · Fiscalização
    + 0,11 · CEAP
    + 0,12 · Transparência`}
        </pre>

        <h2>10. Composição da Participação</h2>
        <p>
          A presença do Senador é medida em duas frentes complementares:
        </p>
        <ul>
          <li>
            <strong>Plenário</strong> — percentual de presença em votações
            nominais do Plenário do Senado (peso 60%).
          </li>
          <li>
            <strong>Comissões</strong> — percentual de presença em votações
            de comissões permanentes, temporárias e CPIs (peso 40%).
          </li>
        </ul>
        <p>
          A inclusão das comissões é importante porque grande parte do
          trabalho legislativo — inclusive a aprovação terminativa de
          projetos — ocorre fora do plenário.
        </p>

        <h2>11. CEAP multidimensional</h2>
        <p>
          A cota parlamentar (CEAP) deixa de ser apenas “gasto total invertido”
          e passa a considerar a <strong>composição do gasto</strong>. As
          despesas são desagregadas em cinco categorias:
        </p>
        <ul>
          <li>Divulgação da atividade parlamentar</li>
          <li>Escritório de apoio (aluguel, material de consumo)</li>
          <li>Locomoção (passagens, combustíveis, hospedagem)</li>
          <li>Consultoria, assessoria e pesquisa</li>
          <li>Outros</li>
        </ul>
        <p>
          Sobre a base invertida do gasto/mês, aplica-se um
          <strong> fator de moderação por divulgação</strong>:
        </p>
        <pre>
{`fator = 1 − 0,6 × (gasto_divulgação / gasto_total)`}
        </pre>
        <p>
          Quando a divulgação é zero, o fator vale 1 (sem penalidade); quando
          equivale a 50% da cota, o fator cai para 0,7; quando concentra 100%,
          cai para 0,4. O resultado: parlamentares que canalizam
          recursos públicos majoritariamente para autopromoção aparecem em
          posições inferiores na dimensão CEAP.
        </p>

        <h2>12. Fontes de dados</h2>
        <ul>
          <li>
            <a
              href="https://legis.senado.leg.br/dadosabertos"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Dados Abertos do Senado (LEGIS)
            </a>{' '}
            — autorias (<code>/processo</code>), relatorias, votações nominais,
            discursos, apartes, lideranças e cargos
          </li>
          <li>
            <a
              href="https://adm.senado.gov.br/adm-dadosabertos"
              target="_blank"
              rel="noopener noreferrer"
            >
              API Administrativa do Senado (ADM)
            </a>{' '}
            — despesas da cota parlamentar (<code>/despesas_ceaps</code>),
            auxílio-moradia e imóvel funcional
          </li>
        </ul>

        <h2>13. Limitações conhecidas</h2>
        <ul>
          <li>
            <strong>Auxílio-moradia.</strong> A API expõe apenas o status
            corrente. O benefício aparece no perfil individual mas não compõe
            o IDS.
          </li>
          <li>
            <strong>Mérito vs. volume.</strong> O IDS mede atividade
            quantificável; não avalia mérito, conteúdo ou relevância política
            das proposições.
          </li>
          <li>
            <strong>Comissões.</strong> Esta versão já inclui votações em
            comissões como 40% da Participação.
          </li>
          <li>
            <strong>Independência partidária.</strong> A análise de coerência
            ou dissidência em relação à orientação da bancada será incorporada
            como dimensão dedicada na próxima fase.
          </li>
          <li>
            <strong>Comparabilidade entre legislaturas.</strong> O ranking é
            válido apenas no escopo da 57ª Legislatura.
          </li>
        </ul>

        <h2>14. Atualização e auditabilidade</h2>
        <p>
          O processamento integral é executado <strong>uma vez por dia</strong>{' '}
          (cron noturno às 03:00 UTC) e armazenado em base de dados para
          garantir resposta instantânea às consultas. O código-fonte completo,
          incluindo o algoritmo de cálculo, está disponível em repositório
          aberto para escrutínio independente.
        </p>

        <h2>15. Responsabilidade editorial</h2>
        <p>
          Esta plataforma é uma iniciativa cidadã independente, sem vínculo
          institucional com o Senado Federal ou qualquer partido político. As
          análises aqui apresentadas refletem exclusivamente os indicadores
          quantitativos descritos nesta metodologia.
        </p>

        <h2>16. Financiamento e independência metodológica</h2>
        <p>
          O financiamento voluntário da plataforma <strong>não interfere</strong>
          {' '}no cálculo do IDS. A metodologia é documentada publicamente, o
          código-fonte é aberto e os dados utilizados são obtidos de bases
          oficiais.
        </p>
        <p>
          Apoios financeiros, patrocínios ou contribuições não conferem
          qualquer influência sobre pesos, critérios, rankings, resultados
          individuais, classificações ou interpretações apresentadas pela
          plataforma. Saiba mais em{' '}
          <a href="/transparencia">Transparência financeira</a> e{' '}
          <a href="/apoie">Apoie o projeto</a>.
        </p>
      </article>
    </div>
  )
}
