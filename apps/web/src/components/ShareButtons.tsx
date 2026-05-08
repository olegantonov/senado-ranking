'use client'

import { useState } from 'react'

const HASHTAGS = ['ObservaSenado', 'TransparenciaParlamentar']

export interface ShareButtonsProps {
  /** Texto principal pré-formatado (sem URL e sem hashtags) */
  texto: string
  /** URL canônica que vai ser compartilhada */
  url: string
  /** Variante visual */
  variante?: 'card' | 'compacto'
  /** Título acima dos botões (apenas card) */
  titulo?: string
}

const HASHTAG_LINE = HASHTAGS.map((h) => `#${h}`).join(' ')

function buildText(texto: string, url: string, withHashtags = true): string {
  const parts = [texto.trim(), url]
  if (withHashtags) parts.push(HASHTAG_LINE)
  return parts.filter(Boolean).join('\n\n')
}

export default function ShareButtons({ texto, url, variante = 'card', titulo }: ShareButtonsProps) {
  const [copied, setCopied] = useState<'link' | 'texto' | null>(null)

  const fullText = buildText(texto, url)
  const fullTextNoUrl = buildText(texto, '', true)

  const enc = (s: string) => encodeURIComponent(s)
  const links = {
    twitter: `https://twitter.com/intent/tweet?text=${enc(`${texto.trim()}\n\n${HASHTAG_LINE}`)}&url=${enc(url)}`,
    whatsapp: `https://wa.me/?text=${enc(fullText)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(texto.trim())}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(`${texto.trim()}\n\n${HASHTAG_LINE}`)}`,
    bluesky: `https://bsky.app/intent/compose?text=${enc(fullText)}`,
  }

  function copy(value: string, kind: 'link' | 'texto') {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {})
    }
    setCopied(kind)
    setTimeout(() => setCopied(null), 1800)
  }

  function shareInstagram() {
    // Instagram não tem intent web. Copia o texto pra clipboard e tenta abrir o app no mobile.
    copy(fullTextNoUrl, 'texto')
    if (typeof window !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      window.location.href = 'instagram://app'
    }
  }

  if (variante === 'compacto') {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted mr-1">Compartilhar:</span>
        <SocialIconLink href={links.twitter}  label="Twitter / X" tone="text-[#1d9bf0]"   icon={iconX} />
        <SocialIconLink href={links.whatsapp} label="WhatsApp"    tone="text-[#25D366]"   icon={iconWhatsapp} />
        <SocialIconLink href={links.telegram} label="Telegram"    tone="text-[#26A5E4]"   icon={iconTelegram} />
        <SocialIconLink href={links.bluesky}  label="Bluesky"     tone="text-[#1185FE]"   icon={iconBluesky} />
        <button
          onClick={() => copy(url, 'link')}
          aria-label="Copiar link"
          title="Copiar link"
          className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border text-muted hover:text-primary hover:border-primary/40 transition-colors"
        >
          {copied === 'link' ? iconCheck : iconLink}
        </button>
      </div>
    )
  }

  return (
    <section className="rounded-sm border border-border bg-panel/50 p-5">
      <p className="eyebrow text-accent">Compartilhe nas redes</p>
      <h3 className="mt-1 font-serif text-lg font-semibold text-ink">
        {titulo ?? 'Ajude a divulgar este perfil'}
      </h3>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        Texto pronto pré-formatado com link e hashtags. Você pode editar antes de publicar.
      </p>

      <pre className="mt-3 max-h-40 overflow-y-auto rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap">
{fullText}
      </pre>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SocialButton href={links.twitter}  label="Twitter / X" bg="bg-[#000]"      icon={iconX} />
        <SocialButton href={links.whatsapp} label="WhatsApp"    bg="bg-[#25D366]"   icon={iconWhatsapp} />
        <SocialButton href={links.telegram} label="Telegram"    bg="bg-[#26A5E4]"   icon={iconTelegram} />
        <SocialButton href={links.bluesky}  label="Bluesky"     bg="bg-[#1185FE]"   icon={iconBluesky} />
        <SocialButton href={links.facebook} label="Facebook"    bg="bg-[#1877F2]"   icon={iconFacebook} />
        <SocialButton href={links.linkedin} label="LinkedIn"    bg="bg-[#0A66C2]"   icon={iconLinkedin} />
        <button
          onClick={shareInstagram}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity"
        >
          {iconInstagram}
          <span>Instagram</span>
        </button>
        <button
          onClick={() => copy(url, 'link')}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
        >
          {copied === 'link' ? iconCheck : iconLink}
          <span>{copied === 'link' ? 'Copiado!' : 'Copiar link'}</span>
        </button>
      </div>

      {copied === 'texto' && (
        <p className="mt-3 text-xs text-emerald-700">
          Texto copiado — cole no app do Instagram (Stories ou caption).
        </p>
      )}
    </section>
  )
}

function SocialButton({ href, label, bg, icon }: { href: string; label: string; bg: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-sm ${bg} px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity`}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

function SocialIconLink({ href, label, tone, icon }: { href: string; label: string; tone: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border ${tone} hover:border-current transition-colors`}
    >
      {icon}
    </a>
  )
}

// ─── ícones SVG inline (sem dependência) ────────────────────────────────────
const iconX = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.084 19.77h1.832L7.084 4.126H5.117L17.084 19.77z" />
  </svg>
)
const iconWhatsapp = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.886a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.609zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
  </svg>
)
const iconTelegram = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
  </svg>
)
const iconBluesky = (
  <svg viewBox="0 0 568 501" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.367 323.8 536.628 388.62 472.6 453.44c-121.582 123.114-174.766-30.91-188.39-70.314-2.498-7.224-3.667-10.602-3.677-7.731-.01-2.871-1.18.507-3.677 7.731-13.624 39.404-66.808 193.428-188.39 70.314-64.026-64.82-34.766-129.64 80.255-149.19C102.99 315.435 29.11 296.955 8.835 224.502 3.002 203.66-6.943 75.293-6.943 57.947c0-86.853 76.135-59.558 130.064-24.283z" />
  </svg>
)
const iconFacebook = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)
const iconLinkedin = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)
const iconInstagram = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
  </svg>
)
const iconLink = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)
const iconCheck = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
