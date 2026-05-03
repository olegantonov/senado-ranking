import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Observatório do Senado — Índice de Desempenho Senatorial',
  description:
    'Iniciativa cidadã independente de transparência parlamentar. Avaliação multidimensional do desempenho dos Senadores da 57ª Legislatura, baseada em dados públicos oficiais.',
  metadataBase: new URL('https://observasenado.org'),
  openGraph: {
    title: 'Observatório do Senado — IDS',
    description:
      'Plataforma independente de monitoramento parlamentar baseada em dados públicos do Senado Federal.',
    type: 'website',
    url: 'https://observasenado.org',
    siteName: 'Observatório do Senado',
  },
  icons: {
    icon: '/logo.png',
  },
}

const NAV = [
  { href: '/', label: 'Ranking' },
  { href: '/comparar', label: 'Comparar' },
  { href: '/metodologia', label: 'Metodologia' },
  { href: '/newsletter', label: 'Newsletter' },
  { href: '/apoie', label: 'Apoie' },
  { href: '/transparencia', label: 'Transparência' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col bg-background text-ink">
        {/* Faixa institucional superior */}
        <div className="bg-primary text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-8 items-center justify-between text-[11px] tracking-wider uppercase">
              <span className="opacity-90">
                Iniciativa Cidadã Independente · Transparência Parlamentar
              </span>
              <span className="hidden sm:inline opacity-75">
                57ª Legislatura · 2023 — 2027
              </span>
            </div>
          </div>
        </div>

        {/* Cabeçalho institucional */}
        <header className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-5">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Observatório do Senado"
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                  priority
                />
                <span className="flex flex-col">
                  <span className="font-serif text-xl font-semibold leading-tight text-ink">
                    Observatório do Senado
                  </span>
                  <span className="text-xs text-muted tracking-wide">
                    Índice de Desempenho Senatorial · IDS
                  </span>
                </span>
              </Link>
              <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-muted hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://github.com/olegantonov/observatorio-senado"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-primary transition-colors"
                >
                  Código-fonte
                </a>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
            {children}
          </div>
        </main>

        {/* Rodapé institucional */}
        <footer className="mt-16 border-t border-border bg-panel">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-2">
                <h3 className="font-serif text-base font-semibold text-ink">
                  Observatório do Senado
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  Iniciativa cidadã independente de transparência parlamentar.
                  Os dados aqui apresentados são obtidos de fontes públicas
                  oficiais e podem ser auditados nas bases do Senado Federal.
                </p>
                <p className="mt-3 text-xs text-muted leading-relaxed">
                  Esta plataforma não possui vínculo institucional com o Senado
                  Federal, partidos políticos, mandatos parlamentares,
                  campanhas eleitorais ou grupos de interesse.
                </p>
              </div>
              <div>
                <h4 className="eyebrow">Plataforma</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/metodologia" className="text-muted hover:text-primary transition-colors">
                      Metodologia
                    </Link>
                  </li>
                  <li>
                    <Link href="/newsletter" className="text-muted hover:text-primary transition-colors">
                      Newsletter
                    </Link>
                  </li>
                  <li>
                    <Link href="/apoie" className="text-muted hover:text-primary transition-colors">
                      Apoie o projeto
                    </Link>
                  </li>
                  <li>
                    <Link href="/transparencia" className="text-muted hover:text-primary transition-colors">
                      Transparência financeira
                    </Link>
                  </li>
                  <li>
                    <Link href="/contato" className="text-muted hover:text-primary transition-colors">
                      Contato e correções
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://github.com/olegantonov/observatorio-senado"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-primary transition-colors"
                    >
                      Código-fonte
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="eyebrow">Legal</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link href="/termos" className="text-muted hover:text-primary transition-colors">
                      Termos de uso
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacidade" className="text-muted hover:text-primary transition-colors">
                      Política de privacidade
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://legis.senado.leg.br/dadosabertos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-primary transition-colors"
                    >
                      Fonte: LEGIS
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://adm.senado.gov.br/adm-dadosabertos"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-primary transition-colors"
                    >
                      Fonte: ADM
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <hr className="divider-rule mt-8" />
            <p className="mt-6 text-xs text-muted text-center max-w-3xl mx-auto leading-relaxed">
              As contribuições financeiras eventualmente recebidas são
              voluntárias e destinadas exclusivamente à manutenção técnica,
              metodológica e operacional do projeto. Nenhum apoiador, doador
              ou parceiro técnico possui controle sobre os resultados do IDS,
              sobre a ordem do ranking ou sobre a metodologia de cálculo.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
