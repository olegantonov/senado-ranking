/**
 * Gera análise jornalística da semana via Cloudflare Workers AI (Llama 3.3 70B).
 * Prompt rigorosamente factual: a IA só comenta dados explicitamente fornecidos.
 *
 * Saída: markdown com 6 seções fixas + metadata (tokens, modelo).
 */

import type { Env } from '../types'
import type { NewsletterData } from './newsletter-data'

const MODEL_PRIMARY = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const MODEL_FALLBACK = '@cf/meta/llama-3.1-70b-instruct'

export interface NewsletterAIResult {
  markdown: string
  modelo: string
  promptTokens?: number
  outputTokens?: number
  fallbackUsed: boolean
}

const SYSTEM_PROMPT = `Você é jornalista político brasileiro experiente, especializado em transparência parlamentar. Escreve para a newsletter semanal do Observatório do Senado, uma iniciativa cidadã independente que avalia o desempenho dos senadores da 57ª Legislatura.

GLOSSÁRIO OBRIGATÓRIO (use APENAS estas definições — nunca invente outras):

- **IDS (Índice de Desempenho Senatorial)**: índice composto de 0 a 100 que sintetiza 6 dimensões da atividade parlamentar (produtividade, efetividade, participação, fiscalização, eficiência da CEAP e transparência). É um indicador metodológico do Observatório, não uma medida oficial do Senado.
- **CEAP (Cota para o Exercício da Atividade Parlamentar)**: cota mensal de reembolso a que cada senador tem direito para custear despesas relacionadas ao mandato — passagens aéreas, hospedagem, locação de imóveis para escritório político, contratação de consultorias, divulgação da atividade parlamentar, combustível, telefonia, material de escritório etc. NÃO é um índice de desempenho nem de cumprimento de agenda. É uma verba pública. O Observatório monitora o uso da CEAP como dimensão de eficiência (gasto mensal) e transparência (% gasto em "divulgação da atividade parlamentar", que é proxy de autopromoção).
- **Suplente**: parlamentar que assume vaga deixada pelo titular afastado (licença, ministério, falecimento). Pode ter exercícios fragmentados.
- **Relatoria**: designação para emitir parecer técnico sobre matéria em comissão.
- **Autoria**: parlamentar responsável pela apresentação de uma matéria (PEC, PL, PLP, RQS etc).

REGRAS RÍGIDAS:
1. Use APENAS os dados estruturados fornecidos. Nunca invente nomes, números, partidos, eventos, expansões de siglas ou justificativas.
2. Tom jornalístico neutro: comente padrões, mas NÃO julgue moralmente. Não use adjetivos como "inativo", "improdutivo", "preguiçoso". Prefira "menor produtividade", "menos votações registradas".
3. Cite senadores pelo nome próprio + (partido/UF), exatamente como nos dados.
4. NÃO invente motivos para movimentações ou variações no IDS. Se os dados não explicam, descreva apenas o fato.
5. Para CEAP: comente valores em reais e padrões de uso (concentração em divulgação, fornecedores, etc.) APENAS se houver dados explícitos. Se não houver, faça uma nota curta lembrando o que é CEAP e que o detalhamento por senador está disponível no site.
6. Português brasileiro formal mas acessível. Frases médias.
7. Saída em markdown, com EXATAMENTE estas seções e nessa ordem:

## Editorial
## Destaques da semana
## Atividade legislativa
## Movimentações
## CEAP em foco
## O que esperar

8. Cada seção: 2-4 parágrafos curtos. Total 500-900 palavras.
9. NÃO escreva preâmbulo nem despedida. Comece direto em "## Editorial".`

function buildUserPrompt(data: NewsletterData): string {
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const top10 = data.topAtual
    .map((s) => {
      const delta = s.delta != null ? (s.delta > 0 ? `+${s.delta}` : `${s.delta}`) : '—'
      const dIds = s.deltaIds != null ? (s.deltaIds > 0 ? `+${s.deltaIds.toFixed(1)}` : s.deltaIds.toFixed(1)) : '—'
      return `${s.posicao}º. ${s.nome} (${s.partido}/${s.uf}) — IDS ${fmt(s.idsTotal)} (Δ posição ${delta} · Δ IDS ${dIds})`
    })
    .join('\n')

  const bottom = data.bottomAtual
    .map((s) => `${s.posicao}º. ${s.nome} (${s.partido}/${s.uf}) — IDS ${fmt(s.idsTotal)}`)
    .join('\n')

  const movers = data.topMovers.length
    ? data.topMovers
        .map((s) => {
          const delta = s.delta != null ? (s.delta > 0 ? `subiu ${s.delta}` : `desceu ${Math.abs(s.delta)}`) : '—'
          const dIds = s.deltaIds != null ? (s.deltaIds > 0 ? `+${s.deltaIds.toFixed(1)}` : s.deltaIds.toFixed(1)) : '—'
          return `- ${s.nome} (${s.partido}/${s.uf}): ${delta} posições · IDS ${fmt(s.idsTotal)} (Δ ${dIds}); de ${s.posicaoAnterior ?? '—'}º para ${s.posicao}º`
        })
        .join('\n')
    : 'Nenhuma alteração relevante no ranking esta semana (variações <5 posições).'

  const movs = data.movimentacoes.length
    ? data.movimentacoes
        .map((m) => {
          if (m.tipo === 'entrou') return `- ENTRADA EM EXERCÍCIO: ${m.nome} (${m.partido}/${m.uf})`
          if (m.tipo === 'afastou') return `- AFASTAMENTO: ${m.nome} (${m.partido}/${m.uf}) — motivo: ${m.motivo ?? 'não informado'}${m.data ? ` · desde ${m.data}` : ''}`
          return `- SAÍDA: ${m.nome} (${m.partido}/${m.uf})`
        })
        .join('\n')
    : 'Nenhuma movimentação de exercício/afastamento registrada na semana.'

  const topAutoresSemana = data.atividade.topAutores?.length
    ? data.atividade.topAutores
        .map((a) => `- ${a.nome} (${a.partido}/${a.uf}): ${a.quantidade} matéria(s) apresentada(s)`)
        .join('\n')
    : '(sem dados de top autores)'

  const agenda = data.agenda.length
    ? data.agenda
        .slice(0, 6)
        .map((e) => `- ${e.dataHora.slice(0, 16).replace('T', ' ')}: ${e.titulo}${e.local ? ` (${e.local})` : ''}`)
        .join('\n')
    : 'Sem eventos públicos confirmados no calendário.'

  // CEAP — dados reais (acumulado anual em R$, não semanal).
  const ceap = data.ceap
  const topGastadores = ceap.topGastadores.length
    ? ceap.topGastadores
        .map((c) => `- ${c.nome} (${c.partido}/${c.uf}): ${fmtBRL(c.total)} acumulados em ${ceap.fonteAno}`)
        .join('\n')
    : '(sem dados de CEAP no snapshot)'
  const topDivulg = ceap.topPctDivulgacao.length
    ? ceap.topPctDivulgacao
        .map((c) => `- ${c.nome} (${c.partido}/${c.uf}): ${c.pct.toFixed(1)}% do total em divulgação (total ${fmtBRL(c.total)})`)
        .join('\n')
    : '(sem dados de % divulgação)'

  return `# Dados estruturados — Edição ${data.edicao}

Semana referência: ${data.semana.inicio} → ${data.semana.fim}
Semana anterior (comparativo): ${data.semanaAnterior.inicio} → ${data.semanaAnterior.fim}
Senadores em exercício: ${data.totalSenadores}

## Panorama
- IDS médio: ${fmt(data.panorama.idsMedio)}
- Maior IDS: ${fmt(data.panorama.idsMaior)}
- Menor IDS: ${fmt(data.panorama.idsMenor)}
- Confiança alta (≥24m de mandato): ${data.panorama.confiancaAlta}
- Confiança baixa (<12m): ${data.panorama.confiancaBaixa}

## Top 10 atual (com deltas vs semana anterior)
${top10}

## Bottom 5
${bottom}

## Maiores movimentos no ranking
${movers}

## Movimentações de exercício
${movs}

## Atividade legislativa da semana
- Matérias apresentadas: ${data.atividade.totalProcessosNovos}
- Votações nominais ocorridas: ${data.atividade.totalVotacoes}
- Discursos registrados: ${data.atividade.totalDiscursos}
- Top autores da semana:
${topAutoresSemana}

## CEAP — dados de uso da cota (acumulado em ${ceap.fonteAno}, em reais)

ATENÇÃO: CEAP é a Cota para o Exercício da Atividade Parlamentar — verba de
reembolso de despesas do mandato (passagens, hospedagem, escritório,
divulgação, consultoria, combustível). NÃO é índice nem medida de agenda.
Comente os valores abaixo de forma factual, sem julgamento moral.

Média de gasto anual entre senadores com despesas registradas: ${fmtBRL(ceap.mediaGastoAno)}

Maiores gastadores no ano:
${topGastadores}

Maior % gasto em divulgação da atividade parlamentar (proxy de autopromoção):
${topDivulg}

## Agenda da próxima semana
${agenda}

---
INSTRUÇÃO: Escreva a newsletter agora seguindo as 6 seções definidas no system prompt. Comece direto em "## Editorial".`
}

interface CFAIResponse {
  success: boolean
  result?: { response?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  errors?: Array<{ message?: string }>
}

async function callModel(env: Env, model: string, system: string, user: string): Promise<CFAIResponse> {
  const acc = process.env.CLOUDFLARE_ACCOUNT_ID
  const email = process.env.CLOUDFLARE_EMAIL
  const key = process.env.CLOUDFLARE_API_KEY
  if (!acc || !email || !key) throw new Error('CLOUDFLARE_* envs ausentes')

  const url = `https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/${model}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 2200,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  return (await res.json()) as CFAIResponse
}

function validar(markdown: string): { ok: boolean; motivo?: string } {
  if (!markdown || markdown.trim().length < 400) return { ok: false, motivo: 'curto demais' }
  const seções = ['## Editorial', '## Destaques da semana', '## Atividade legislativa', '## Movimentações', '## CEAP em foco', '## O que esperar']
  for (const s of seções) {
    if (!markdown.includes(s)) return { ok: false, motivo: `seção ausente: ${s}` }
  }
  return { ok: true }
}

export async function gerarAnalise(env: Env, data: NewsletterData): Promise<NewsletterAIResult> {
  const user = buildUserPrompt(data)

  // Tentativa 1: Llama 3.3 70B FP8 fast
  const r1 = await callModel(env, MODEL_PRIMARY, SYSTEM_PROMPT, user)
  if (r1.success && r1.result?.response) {
    const v = validar(r1.result.response)
    if (v.ok) {
      return {
        markdown: r1.result.response.trim(),
        modelo: MODEL_PRIMARY,
        promptTokens: r1.result.usage?.prompt_tokens,
        outputTokens: r1.result.usage?.completion_tokens,
        fallbackUsed: false,
      }
    }
    console.warn(`[newsletter-ai] saída do primário inválida (${v.motivo}), tentando fallback`)
  } else {
    console.warn('[newsletter-ai] primário falhou:', r1.errors)
  }

  // Tentativa 2: Llama 3.1 70B
  const r2 = await callModel(env, MODEL_FALLBACK, SYSTEM_PROMPT, user)
  if (r2.success && r2.result?.response) {
    const v = validar(r2.result.response)
    if (v.ok) {
      return {
        markdown: r2.result.response.trim(),
        modelo: MODEL_FALLBACK,
        promptTokens: r2.result.usage?.prompt_tokens,
        outputTokens: r2.result.usage?.completion_tokens,
        fallbackUsed: true,
      }
    }
  }

  throw new Error('IA não produziu saída válida em nenhum dos modelos')
}
