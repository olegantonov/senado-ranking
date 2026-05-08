/**
 * Cron de newsletter — segunda 09:00 BRT (12:00 UTC).
 *
 * Modo de operação:
 *   - Sempre gera o preview semanal e grava em newsletter_runs.
 *   - Se variável APROVACAO_MANUAL=1 (default por enquanto): envia a versão
 *     de preview SOMENTE para o email do admin (ADMIN_PREVIEW_EMAIL) e fica
 *     aguardando ADMIN executar `enviar` manualmente.
 *   - Se APROVACAO_MANUAL=0: envia automaticamente para todos os subscribers.
 */

import { gerarPreview, enviarEdicao } from '../../services/newsletter'
import { env } from './env'

async function main() {
  const started = Date.now()
  const aprovacaoManual = process.env.APROVACAO_MANUAL !== '0'
  const adminEmail = process.env.ADMIN_PREVIEW_EMAIL || env.ENVIRONMENT === 'production'
    ? process.env.ADMIN_PREVIEW_EMAIL
    : undefined

  console.log(`[newsletter-cron] início (aprovacaoManual=${aprovacaoManual})`)

  try {
    const preview = await gerarPreview(env)
    console.log(`[newsletter-cron] preview ${preview.edicao} (${preview.modelo}) — tokens p=${preview.promptTokens} o=${preview.outputTokens} reused=${preview.reused}`)

    if (preview.status === 'sent') {
      console.log(`[newsletter-cron] edição ${preview.edicao} já foi enviada anteriormente — abortando.`)
      process.exit(0)
    }

    if (aprovacaoManual) {
      if (!adminEmail) {
        console.warn('[newsletter-cron] APROVACAO_MANUAL=1 mas ADMIN_PREVIEW_EMAIL ausente — preview gerado mas não enviado a ninguém.')
        process.exit(0)
      }
      const r = await enviarEdicao(env, preview.edicao, { adminOnly: true, adminEmail })
      console.log(`[newsletter-cron] preview enviado ao admin (${adminEmail}): ok=${r.enviados} fail=${r.falhas}`)
    } else {
      const r = await enviarEdicao(env, preview.edicao, {})
      console.log(`[newsletter-cron] envio em massa: ok=${r.enviados} fail=${r.falhas}`)
      if (r.rejeitados.length) console.log('[newsletter-cron] rejeitados:', r.rejeitados.slice(0, 5))
    }

    const dur = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`[newsletter-cron] OK em ${dur}s`)
    process.exit(0)
  } catch (err) {
    console.error('[newsletter-cron] erro:', err)
    process.exit(1)
  }
}

main()
