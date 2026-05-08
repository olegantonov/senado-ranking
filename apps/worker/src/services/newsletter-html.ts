/**
 * Renderiza o markdown gerado pela IA + tabela top 5 num HTML email-safe.
 * Sem CSS externo, sem JS, layout em tabela aninhada para máxima compatibilidade
 * (Gmail, Outlook, Apple Mail, clients web).
 */

import type { NewsletterData } from './newsletter-data'

const SITE = 'https://observasenado.org'
const COR_INK = '#0d1421'
const COR_MUTED = '#5a6273'
const COR_BORDER = '#e5e7eb'
const COR_PANEL = '#f7f9fb'
const COR_PRIMARY = '#1e3a8a'
const COR_ACCENT = '#92400e'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Conversão markdown → HTML mínima, suficiente pro output da IA (## ### **bold** *italic* lista). */
function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h2 style="font-family:Georgia,serif;font-size:20px;color:${COR_INK};margin:32px 0 12px;border-bottom:1px solid ${COR_BORDER};padding-bottom:6px;">${escapeHtml(line.slice(3))}</h2>`)
    } else if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<h3 style="font-family:Georgia,serif;font-size:16px;color:${COR_INK};margin:20px 0 8px;">${escapeHtml(line.slice(4))}</h3>`)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { out.push(`<ul style="margin:8px 0 14px;padding-left:20px;color:${COR_MUTED};">`); inList = true }
      out.push(`<li style="margin:4px 0;line-height:1.55;">${inlineMd(line.slice(2))}</li>`)
    } else if (line.match(/^\d+\.\s/)) {
      if (!inList) { out.push(`<ol style="margin:8px 0 14px;padding-left:20px;color:${COR_MUTED};">`); inList = true }
      out.push(`<li style="margin:4px 0;line-height:1.55;">${inlineMd(line.replace(/^\d+\.\s/, ''))}</li>`)
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false }
    } else {
      if (inList) { out.push('</ul>'); inList = false }
      out.push(`<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COR_MUTED};">${inlineMd(line)}</p>`)
    }
  }
  if (inList) out.push('</ul>')
  return out.join('\n')
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${COR_INK};">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

function deltaBadge(delta: number | undefined): string {
  if (delta == null || delta === 0) return `<span style="color:${COR_MUTED};font-family:monospace;">—</span>`
  const isUp = delta > 0
  const cor = isUp ? '#15803d' : '#b91c1c'
  const seta = isUp ? '▲' : '▼'
  return `<span style="color:${cor};font-family:monospace;">${seta}${Math.abs(delta)}</span>`
}

function formatBR(d: string): string {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export interface NewsletterHtmlOutput {
  subject: string
  preheader: string
  html: string
  text: string  // versão plain-text fallback
}

export function renderNewsletter(
  data: NewsletterData,
  markdown: string,
): NewsletterHtmlOutput {
  const subject = `Observatório do Senado · Edição ${data.edicao} (${formatBR(data.semana.inicio)} a ${formatBR(data.semana.fim)})`
  const preheader = `Análise da ${data.edicao}: ${data.totalSenadores} senadores, IDS médio ${data.panorama.idsMedio.toFixed(1)}, ${data.atividade.totalProcessosNovos} matérias novas e ${data.atividade.totalVotacoes} votações.`

  const corpoMd = mdToHtml(markdown)

  const linhasTop = data.topAtual
    .slice(0, 5)
    .map((s) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid ${COR_BORDER};font-family:monospace;color:${COR_MUTED};font-size:13px;">${s.posicao}º</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COR_BORDER};color:${COR_INK};font-size:14px;">
          <a href="${SITE}/senador?codigo=${s.senadorCod}" style="color:${COR_INK};text-decoration:none;font-weight:600;">${escapeHtml(s.nome)}</a>
          <span style="color:${COR_MUTED};font-size:12px;">${escapeHtml(s.partido)}/${escapeHtml(s.uf)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COR_BORDER};text-align:right;font-family:monospace;color:${COR_INK};font-size:14px;font-weight:600;">${s.idsTotal.toFixed(1)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid ${COR_BORDER};text-align:right;font-size:13px;">${deltaBadge(s.delta)}</td>
      </tr>`)
    .join('')

  const linhasMovers = data.topMovers.slice(0, 4).map((s) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid ${COR_BORDER};color:${COR_INK};font-size:13px;">
        <a href="${SITE}/senador?codigo=${s.senadorCod}" style="color:${COR_INK};text-decoration:none;">${escapeHtml(s.nome)}</a>
        <span style="color:${COR_MUTED};font-size:11px;">${escapeHtml(s.partido)}/${escapeHtml(s.uf)}</span>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid ${COR_BORDER};text-align:right;font-size:12px;color:${COR_MUTED};">${s.posicaoAnterior ?? '—'}º → ${s.posicao}º</td>
      <td style="padding:6px 10px;border-bottom:1px solid ${COR_BORDER};text-align:right;font-size:13px;">${deltaBadge(s.delta)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COR_PANEL};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COR_INK};">
<!-- preheader oculto -->
<div style="display:none;font-size:1px;color:${COR_PANEL};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
${escapeHtml(preheader)}
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${COR_PANEL};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;background:#ffffff;border:1px solid ${COR_BORDER};border-radius:4px;">

        <!-- HEADER -->
        <tr>
          <td style="padding:24px 28px 12px;border-bottom:1px solid ${COR_BORDER};">
            <p style="margin:0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${COR_MUTED};font-weight:600;">Observatório do Senado</p>
            <h1 style="margin:8px 0 4px;font-family:Georgia,serif;font-size:24px;color:${COR_INK};font-weight:600;">Edição ${escapeHtml(data.edicao)}</h1>
            <p style="margin:0;font-size:13px;color:${COR_MUTED};">Semana de ${formatBR(data.semana.inicio)} a ${formatBR(data.semana.fim)}</p>
          </td>
        </tr>

        <!-- PANORAMA STATS -->
        <tr>
          <td style="padding:20px 28px 8px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="33%" style="text-align:center;padding:8px;border-right:1px solid ${COR_BORDER};">
                  <p style="margin:0;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${COR_MUTED};">IDS médio</p>
                  <p style="margin:4px 0 0;font-family:Georgia,serif;font-size:22px;color:${COR_INK};font-weight:600;">${data.panorama.idsMedio.toFixed(1)}</p>
                </td>
                <td width="33%" style="text-align:center;padding:8px;border-right:1px solid ${COR_BORDER};">
                  <p style="margin:0;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${COR_MUTED};">Matérias novas</p>
                  <p style="margin:4px 0 0;font-family:Georgia,serif;font-size:22px;color:${COR_INK};font-weight:600;">${data.atividade.totalProcessosNovos}</p>
                </td>
                <td width="33%" style="text-align:center;padding:8px;">
                  <p style="margin:0;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${COR_MUTED};">Votações</p>
                  <p style="margin:4px 0 0;font-family:Georgia,serif;font-size:22px;color:${COR_INK};font-weight:600;">${data.atividade.totalVotacoes}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ANÁLISE (markdown da IA) -->
        <tr>
          <td style="padding:8px 28px 16px;">
            ${corpoMd}
          </td>
        </tr>

        <!-- TOP 5 -->
        <tr>
          <td style="padding:0 28px 24px;">
            <h2 style="font-family:Georgia,serif;font-size:20px;color:${COR_INK};margin:24px 0 12px;border-bottom:1px solid ${COR_BORDER};padding-bottom:6px;">Top 5 esta semana</h2>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid ${COR_BORDER};border-radius:3px;">
              <thead>
                <tr style="background:${COR_PANEL};">
                  <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${COR_MUTED};font-weight:600;">Pos</th>
                  <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${COR_MUTED};font-weight:600;">Senador</th>
                  <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${COR_MUTED};font-weight:600;">IDS</th>
                  <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${COR_MUTED};font-weight:600;">Δ</th>
                </tr>
              </thead>
              <tbody>${linhasTop}</tbody>
            </table>
            <p style="margin:8px 0 0;font-size:12px;color:${COR_MUTED};">
              <a href="${SITE}" style="color:${COR_PRIMARY};text-decoration:none;">Ver ranking completo →</a>
            </p>
          </td>
        </tr>

        ${data.topMovers.length > 0 ? `
        <!-- MOVERS -->
        <tr>
          <td style="padding:0 28px 24px;">
            <h3 style="font-family:Georgia,serif;font-size:16px;color:${COR_INK};margin:0 0 8px;">Maiores movimentos</h3>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid ${COR_BORDER};border-radius:3px;">
              ${linhasMovers}
            </table>
          </td>
        </tr>` : ''}

        <!-- CTA -->
        <tr>
          <td style="padding:8px 28px 28px;text-align:center;">
            <a href="${SITE}" style="display:inline-block;background:${COR_PRIMARY};color:#fff;text-decoration:none;padding:12px 28px;border-radius:3px;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">
              Acessar o Observatório do Senado
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:20px 28px;background:${COR_PANEL};border-top:1px solid ${COR_BORDER};">
            <p style="margin:0;font-size:11px;color:${COR_MUTED};line-height:1.6;">
              Você recebeu este e-mail porque é assinante da newsletter do Observatório do Senado, iniciativa cidadã independente sem vínculo com o Senado Federal, partidos ou mandatos parlamentares. Dados oficiais coletados em <a href="https://legis.senado.leg.br/dadosabertos" style="color:${COR_PRIMARY};">legis.senado.leg.br/dadosabertos</a>.
            </p>
            <p style="margin:10px 0 0;font-size:11px;color:${COR_MUTED};">
              <a href="${SITE}/metodologia" style="color:${COR_PRIMARY};text-decoration:none;">Metodologia</a> ·
              <a href="${SITE}/transparencia" style="color:${COR_PRIMARY};text-decoration:none;">Transparência</a> ·
              <a href="${SITE}/apoie" style="color:${COR_PRIMARY};text-decoration:none;">Apoie</a> ·
              <a href="{{UNSUBSCRIBE_URL}}" style="color:${COR_MUTED};text-decoration:underline;">Cancelar inscrição</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  // Plain-text fallback
  const text = [
    `OBSERVATÓRIO DO SENADO · Edição ${data.edicao}`,
    `Semana ${formatBR(data.semana.inicio)} a ${formatBR(data.semana.fim)}`,
    '',
    markdown,
    '',
    '---',
    'Top 5 esta semana:',
    ...data.topAtual.slice(0, 5).map((s) => `${s.posicao}º. ${s.nome} (${s.partido}/${s.uf}) — IDS ${s.idsTotal.toFixed(1)}`),
    '',
    `Acessar: ${SITE}`,
    'Cancelar: {{UNSUBSCRIBE_URL}}',
  ].join('\n')

  return { subject, preheader, html, text }
}
