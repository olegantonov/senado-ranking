# Contribuindo

Obrigado pelo interesse em contribuir com o **Senado Ranking**. Este é um projeto de auditoria pública — críticas e correções são parte essencial dele.

## Tipos de contribuição bem-vindas

### 🔬 Crítica metodológica
Discorda dos pesos? Acha que uma fórmula tem viés? Quer propor uma dimensão nova?
- Abra uma [issue](https://github.com/olegantonov/senado-ranking/issues/new) com o label `metodologia`
- Argumente com base estatística ou referência acadêmica quando possível
- Aceitamos discussão pública e mudanças quando bem fundamentadas

### 🐛 Inconsistência em dados de senador
Encontrou um número que não bate com a fonte oficial?
- Abra issue com label `dados`
- Inclua: nome do senador, código (ex: `6009`), campo problemático (ex: `autoriasAprovadas`), valor mostrado e valor esperado
- Sempre que possível, link para o endpoint oficial do Senado que comprova a divergência

### 💻 Código
- Bugs, melhorias de performance, refatorações: PR direto
- Mudanças que afetam o cálculo do IDS: **abra issue antes** para discutir
- Siga o padrão de TypeScript estrito do projeto; rode `pnpm typecheck` antes de commitar

### 📖 Documentação
- Correções no README, na metodologia ou em comentários: PR direto
- Tradução: bem-vindo, mas o canônico permanece em pt-BR

## Padrões

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:` etc.
- **Português** nas mensagens de commit, nas issues e nos comentários do código (o projeto é sobre o Senado brasileiro)
- **Sem dependências pesadas** sem discussão prévia
- **Sem dados pessoais identificáveis** além do que já é público nas APIs do Senado

## Code review

Mantenedor: [@olegantonov](https://github.com/olegantonov).
PRs costumam receber review em até 7 dias. Ranking é recalculado automaticamente após merge na `main`.

## Código de conduta

Seja respeitoso. Discorde do conteúdo, nunca da pessoa. Discussões sobre senadores específicos devem se ater a fatos públicos e dados verificáveis — este não é espaço para campanha eleitoral, ataques pessoais ou desinformação.

Decisões finais sobre metodologia ficam com os mantenedores, mas todas as escolhas são documentadas e auditáveis.
