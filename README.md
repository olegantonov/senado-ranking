# Observatório do Senado — IDS

> **Iniciativa cidadã independente de transparência parlamentar**
> Índice de Desempenho Senatorial (IDS) baseado em dados abertos do Senado Federal.

[![Deploy Worker](https://github.com/olegantonov/observatorio-senado/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/olegantonov/observatorio-senado/actions/workflows/deploy-worker.yml)
[![Deploy Pages](https://github.com/olegantonov/observatorio-senado/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/olegantonov/observatorio-senado/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🔗 **Produção:** https://observasenado.org
📖 **Metodologia completa:** [`docs/ANALISE_METODOLOGIA_v2.md`](docs/ANALISE_METODOLOGIA_v2.md)
❤️ **Apoie:** [opencollective.com/observatorio-do-senado](https://opencollective.com/observatorio-do-senado) (em aprovação)

---

## 🏛 O que é

O **Observatório do Senado** calcula e publica o **Índice de Desempenho Senatorial (IDS)** — uma avaliação multidimensional, transparente e auditável dos 81 senadores brasileiros em exercício, restrita à **57ª Legislatura (a partir de 01/02/2023)**.

É uma **iniciativa cidadã independente**, sem vínculo institucional com o Senado Federal, partidos políticos, mandatos parlamentares, campanhas eleitorais ou grupos de interesse.

O projeto é **100% open data + open source**: todo o código, fórmulas, pesos e fontes estão neste repositório, e qualquer pessoa pode reproduzir, auditar ou contestar os resultados.

### Dimensões avaliadas (IDS v2.2)

| Dimensão | Peso | O que mede |
|---|---|---|
| **Produtividade** | 20% | Pontos ponderados por tipo de proposição autorada / mês ativo |
| **Efetividade** | 24% | Razão entre status efetivo das autorias e potencial máximo |
| **Participação** | 20% | 60% votações em plenário + 40% votações em comissão |
| **Fiscalização** | 13% | Relatorias / mês, com ajuste por cargos de liderança |
| **Eficiência CEAP** | 11% | Gasto mensal invertido + penalidade por % em "divulgação" |
| **Transparência** | 12% | (Discursos + 0,5 × apartes) / mês ativo |

Cada dimensão é normalizada via **z-score → percentil CDF Normal (0–100)** para comparação justa entre senadores com diferentes tempos de mandato.

> ⚠️ Os pesos são uma escolha metodológica explícita — não há "peso correto". Veja [`docs/ANALISE_METODOLOGIA_v2.md`](docs/ANALISE_METODOLOGIA_v2.md) para a justificativa de cada um e abra uma issue se quiser propor revisão.

---

## 🚀 Stack

```
Frontend     Next.js 15 (App Router, static export) + Tailwind + Recharts → Cloudflare Pages
Backend      Cloudflare Workers (TypeScript) + Hono framework
Banco        Cloudflare D1 (SQLite) — snapshots históricos do ranking
Cache        Cloudflare KV — respostas das APIs do Senado (TTL 6h)
Cron         Cloudflare Workers Cron Triggers — recalcula 1×/dia (03:00 UTC)
CI/CD        GitHub Actions → deploy automático em push na main
```

---

## 📁 Estrutura

```
senado-ranking/
├── .github/workflows/
│   ├── deploy-pages.yml      # CI: Next.js → Cloudflare Pages
│   └── deploy-worker.yml     # CI: Worker → Cloudflare
├── apps/
│   ├── web/                  # Next.js 15 (static export)
│   │   └── src/
│   │       ├── app/          # /, /senador, /comparar, /metodologia
│   │       ├── components/   # RankingTable, SenadorRadar, CeapBarChart, FilterBar
│   │       └── lib/          # api.ts, types.ts
│   └── worker/               # Cloudflare Worker (Hono)
│       └── src/
│           ├── routes/       # ranking, senador, ceap
│           ├── services/     # legis.ts, adm.ts, ranking.ts (algoritmo IDS)
│           ├── db/schema.sql
│           └── types.ts
├── docs/
│   └── ANALISE_METODOLOGIA_v2.md   # justificativa científica completa
├── package.json
└── pnpm-workspace.yaml
```

---

## 🧮 Algoritmo IDS (v2.2 — em produção)

```typescript
// Pesos (somam 1.0)
const WEIGHTS = {
  produtividade: 0.20,
  efetividade:   0.24,
  participacao:  0.20,
  fiscalizacao:  0.13,
  ceap:          0.11,  // invertido: menor gasto = maior score
  transparencia: 0.12,
}

// Pesos por tipo de proposição (Produtividade & Efetividade)
const PESO_PROPOSICAO = { PEC: 3.0, PLP: 2.0, PL: 1.5, MPV: 1.0, RQS: 0.4, IND: 0.2 }

// Pesos por status final (Efetividade)
const PESO_STATUS = {
  TRANSFORMADA_EM_NORMA_JURIDICA:    3.0,  // virou lei
  APROVADA_NO_PLENARIO:              1.5,
  APROVADA_EM_COMISSAO_TERMINATIVA:  1.5,
  TRAMITAÇÃO_AVANÇADA:               0.5,
}

// Normalização final
// dimensão_normalizada = 100 × Φ(z), onde z = (x - μ) / σ
// IDS = Σ (dim_normalizada × peso)
```

### Decisões metodológicas

- **Janela temporal**: apenas 57ª Legislatura (≥ 01/02/2023) — evita comparar carreiras de tempos diferentes
- **Por mês ativo**: produtividade, fiscalização, transparência e CEAP são divididos por meses de mandato — neutraliza vantagem de quem está há mais tempo
- **Status real**: usa `siglaTipoDeliberacao` da API LEGIS (não o campo livre `descricaoSituacao`)
- **Cargos de liderança históricos**: ativos pesam 1.0; encerrados durante a Leg 57 pesam 0.4 (acesso estrutural durante o período)
- **Penalidade autopromoção**: % alto da CEAP em "Divulgação da atividade parlamentar" reduz o score (fator multiplicador 1 - 0.6 × pct)
- **Auxílio moradia**: apenas informacional no perfil; **não** entra no score (decisão deliberada — é um direito, não desempenho)

Detalhes completos, justificativas estatísticas, comparação v1 vs v2 e limitações conhecidas em [`docs/ANALISE_METODOLOGIA_v2.md`](docs/ANALISE_METODOLOGIA_v2.md).

---

## 📡 API pública

Base: `https://senado-ranking-worker.daniel-marques-silva.workers.dev`

| Endpoint | Descrição |
|---|---|
| `GET /health` | Health check |
| `GET /api/ranking` | Ranking completo (filtros: `?partido=PT&uf=SP&bloco=...`) |
| `GET /api/ranking/meta` | Partidos, UFs e blocos disponíveis |
| `GET /api/senador/:codigo` | Detalhes de um senador |
| `GET /api/ceap/:codigo?ano=2024` | Gastos CEAP mensais |

CORS aberto. Sem autenticação. Sinta-se à vontade para consumir.

---

## 🔬 Auditoria & Reprodutibilidade

Este projeto foi pensado para **auditoria pública**. Você pode:

1. **Reproduzir o cálculo do zero**:
   ```bash
   git clone https://github.com/olegantonov/senado-ranking
   cd senado-ranking && pnpm install
   # rode o worker local apontando pra D1+KV próprios e dispare /admin/recalculate
   ```
2. **Inspecionar os dados brutos**: cada senador tem cache em KV (`raw:v2:{cod}`) com as dimensões antes da normalização
3. **Checar fontes oficiais**: todos os endpoints consumidos estão documentados em [`docs/ANALISE_METODOLOGIA_v2.md`](docs/ANALISE_METODOLOGIA_v2.md) e usam exclusivamente as APIs públicas do Senado
4. **Contestar metodologia**: abra uma [issue](https://github.com/olegantonov/senado-ranking/issues) com sua proposta de revisão de pesos, fórmulas ou fontes — discussão pública e argumentada
5. **Reportar inconsistência em dados de um senador específico**: abra issue com o nome, código e o campo problemático — comparamos com a fonte oficial

### O que este ranking **NÃO** faz

- ❌ Não atribui rótulos morais ("bom" / "ruim" senador)
- ❌ Não pondera viés ideológico — só sinais públicos de atividade parlamentar
- ❌ Não substitui o julgamento do eleitor — é um insumo, não veredito
- ❌ Não cobre coerência discurso × voto (limitação reconhecida — veja docs)

---

## ⚙️ Setup local

### Pré-requisitos
- Node.js ≥ 22, pnpm ≥ 9, Wrangler CLI, conta Cloudflare

### Quickstart

```bash
git clone https://github.com/olegantonov/senado-ranking
cd senado-ranking
pnpm install

# 1. Crie recursos Cloudflare próprios
wrangler kv:namespace create SENADO_CACHE
wrangler d1 create senado-ranking
wrangler d1 execute senado-ranking --file=apps/worker/src/db/schema.sql

# 2. Substitua os IDs em apps/worker/wrangler.toml

# 3. Configure secrets do worker (apenas ADMIN_SECRET é sensível)
wrangler secret put ADMIN_SECRET --name senado-ranking-worker

# 4. Rode local
pnpm dev:worker        # terminal 1
NEXT_PUBLIC_API_URL=http://localhost:8787 pnpm dev:web   # terminal 2
```

### GitHub Secrets (para CI/CD opcional)

| Secret | Descrição |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token CF com permissão Workers + Pages + D1 + KV |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| `NEXT_PUBLIC_API_URL` | URL pública do worker |

---

## 📊 Fontes de dados

- **LEGIS API**: https://legis.senado.leg.br/dadosabertos
- **ADM API**: https://adm.senado.gov.br/adm-dadosabertos

Atualização: **diária às 03:00 UTC** via Cron Trigger (`0 3 * * *`). Cache KV de 6h reduz pressão sobre as APIs do Senado.

---

## 🤝 Contribuindo

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md). Críticas metodológicas, correções de dados e PRs são bem-vindos.

---

## 📜 Licença

MIT — veja [`LICENSE`](LICENSE).
Os dados consumidos são públicos, providos pelo Senado Federal Brasileiro através de suas APIs de Dados Abertos.
