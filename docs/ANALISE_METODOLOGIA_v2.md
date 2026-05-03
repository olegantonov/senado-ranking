# Análise Crítica do IDS v1 e Proposta de Metodologia v2

**Autor:** Análise técnica do Observatório
**Data:** 2026-05-02
**Status:** Proposta — aguardando aprovação para implementação

---

## 1. Diagnóstico do IDS v1 (atual)

### 1.1 Pesos e dimensões em uso

| Dimensão | Peso | Indicador bruto | Endpoint |
|---|---|---|---|
| Produtividade | 25% | autorias / mês ativo | `/processo?codigoParlamentarAutor=` |
| Efetividade | 20% | % autorias aprovadas/transformadas | mesmo + status |
| Participação | 20% | % presença em votações nominais | `/senador/{cod}/votacoes.json` |
| Fiscalização | 15% | relatorias / mês ativo | `/senador/{cod}/relatorias.json` |
| Eficiência CEAP | 10% | gasto/mês (invertido) | ADM `/despesas_ceaps/{ano}` |
| Transparência | 10% | discursos / mês ativo | `/senador/{cod}/discursos.json` |

### 1.2 Problemas identificados

**P1 — Produtividade infla artificialmente.** 25% é peso muito alto para um indicador puramente quantitativo. Um Senador pode apresentar 100 requerimentos vagos no mês e bater qualquer PEC trabalhosa. **Trata todas as proposições como iguais** (PEC = PL = Requerimento = Indicação).

**P2 — Efetividade ignora natureza da proposição.** Aprovar um requerimento de voto de pesar pesa igual a transformar um PL em lei. Isso favorece quem apresenta proposições "fáceis".

**P3 — Fiscalização é viés estrutural puro.** Relatorias são distribuídas por presidência de comissão. Líderes e presidentes acumulam por cargo, não por mérito. Hoje **não há ajuste para esse viés**.

**P4 — Participação só conta plenário.** Ignora completamente comissões. Trabalho de comissão é onde 70% da produção real acontece.

**P5 — CEAP é unidimensional.** Só olha valor total. Não distingue gasto operacional (passagens, escritório) de gasto autopromocional (divulgação, postagem). Não inclui **cartão corporativo (supridos)** nem **número de escritórios**.

**P6 — Transparência = volume de discurso.** Conta quantidade, não qualidade. Discursos de 30 segundos pesam igual a pareceres de 40 minutos. Ignora **apartes** (intervenções em discursos alheios), que também são forma de participação no debate.

**P7 — Sem dimensão de independência/coerência partidária.** Não medimos nada relacionado a **votar contra orientação da bancada** vs seguir cegamente. Indicadores acadêmicos modernos (FGV, Atlas Político) consideram isso como medida de **autonomia parlamentar**.

**P8 — Sem ajuste para cargos de liderança.** Presidentes da Mesa, líderes de bancada e relatores especiais têm acesso desigual a oportunidades. Sem essa nota, comparamos maçãs com laranjas.

---

## 2. Endpoints subutilizados — oportunidades

### 2.1 LEGIS (Dados Abertos Legislativos)

| Endpoint | O que adiciona | Custo | Valor agregado |
|---|---|---|---|
| `/senador/{cod}/apartes.json` | Intervenções em discursos alheios | baixo | Refina Transparência |
| `/senador/{cod}/comissoes.json` | Comissões com participação ativa | baixo | Diversificação parlamentar |
| `/senador/{cod}/liderancas.json` | Cargos de liderança | baixo | Ajuste estrutural |
| `/senador/{cod}/cargos.json` | Cargos exercidos (Mesa, presidência) | baixo | Ajuste estrutural |
| `/votacaoComissao/parlamentar/{cod}.json` | Votações em comissão | médio | Refina Participação |
| `/plenario/votacao/orientacaoBancada/{di}/{df}` | Orientação da bancada por sessão | alto | **Nova dimensão: independência** |
| `/processo` filtrado por sigla | PEC vs PL vs Requerimento | baixo | Refina Produtividade (peso por tipo) |
| `/orcamento/lista.json` | Emendas parlamentares ao orçamento | médio | Nova métrica de articulação |
| `/comissao/cpi/{c}/requerimentos.json` | Requerimentos de CPI | médio | Refina Fiscalização |
| `/materia/vetos/{ano}` | Apreciação de vetos | médio | Atividade legislativa adicional |
| `/materia/situacaoatual/{cod}` | Status detalhado de cada autoria | médio | Refina Efetividade |

### 2.2 ADM (Dados Administrativos)

| Endpoint | O que adiciona | Valor agregado |
|---|---|---|
| `/api/v1/senadores/escritorios` | Número de escritórios de apoio | Refina CEAP (custo estrutural) |
| `/api/v1/supridos/{ano}` | Cartão corporativo | Refina CEAP (gasto adicional) |
| `/api/v1/senadores/despesas_ceaps/{ano}` (campos `tipoDespesa`) | Categoria do gasto | Detecta padrão autopromocional |

---

## 3. Proposta — IDS v2

### 3.1 Princípios

1. **Qualidade pesa mais que quantidade.** PEC > PLP > PL > Requerimento.
2. **Efeito real importa.** Lei sancionada vale 3× mais que PL aprovado em uma casa.
3. **Comissão conta tanto quanto plenário.**
4. **Ajuste por oportunidade.** Líderes e presidentes recebem nota descontada para neutralizar viés estrutural.
5. **Autonomia é virtude.** Independência de voto entra como dimensão.

### 3.2 Nova matriz de dimensões (7 dimensões, pesos revisados)

| Dimensão | Peso v1 | Peso v2 | Justificativa |
|---|---|---|---|
| Produtividade Legislativa | 25% | **18%** | Reduzido — passa a ponderar por tipo |
| Efetividade | 20% | **22%** | Aumentado — medida de impacto real |
| Participação | 20% | **18%** | Ligeiro ajuste; passa a incluir comissões |
| Fiscalização | 15% | **12%** | Reduzido + ajustado por cargo |
| Eficiência CEAP | 10% | **10%** | Mantido, mas com sub-componentes |
| Transparência & Debate | 10% | **8%** | Reduzido |
| **Independência (NOVA)** | — | **12%** | Coerência/dissidência consciente |
| **Total** | 100% | **100%** | |

### 3.3 Detalhamento das fórmulas v2

**Produtividade Legislativa (18%)**
```
score = (3·PECs + 2·PLPs + 1.5·PLs + 1·MPVs + 0.4·Requerimentos + 0.2·Indicações) / meses_ativos
```
Pondera por complexidade da proposição. Limita inflação por requerimentos.

**Efetividade (22%)**
```
score = (3·leis_sancionadas + 1.5·aprovadas_no_SF + 0.5·em_tramitação_avançada) / total_autorias
```
Diferencia "virou lei" de "aprovado no Senado mas parado na Câmara" de "ainda em comissão". Endpoint `/processo/{id}` traz status detalhado.

**Participação (18%)**
```
score = 0.6·presença_plenário + 0.4·presença_comissões
```
Inclui votações em comissão. Endpoint `/votacaoComissao/parlamentar/{cod}`.

**Fiscalização (12%) — com ajuste por oportunidade**
```
relatorias_score = relatorias / meses_ativos
ajuste = 1 / (1 + 0.3·cargos_liderança)   # presidente comissão = 1.3 cargos
score = (relatorias_score + 0.5·CPI_requerimentos) · ajuste
```
Quem é presidente de comissão tem oferta inflada de relatorias — descontamos.

**Eficiência CEAP (10%) — multidimensional**
```
custo_total = CEAP + cartão_corporativo + (n_escritórios · custo_padrão_escritório)
score = -(custo_total / meses_ativos)
penalidade = % gasto em "DIVULGAÇÃO" (autopromoção); reduz score se >30%
```
Não basta gastar pouco — gastar bem importa.

**Transparência & Debate (8%)**
```
score = (discursos + 0.5·apartes) / meses_ativos
```
Inclui apartes (intervenções em discursos alheios) — sinal de engajamento no debate, não só palanque solo.

**Independência Parlamentar (12%) — NOVA**
```
desvios_significativos = nº de votações onde votou contra orientação da bancada
                        em pautas de relevância (não meros encaminhamentos)
score = sigmoide normalizada (não premia rebeldia indiscriminada nem submissão total)
```
Endpoint `/plenario/votacao/orientacaoBancada/{di}/{df}` × `/senador/{cod}/votacoes`. Identifica quem é parlamentar autônomo vs voto-de-cabresto.

### 3.4 Nota visível "Cargos detidos"

Não entra no IDS, mas é exibido no perfil para contextualizar:
- Mesa Diretora (Presidente / 1º-VP / Secretário)
- Liderança de partido / bloco / governo / oposição
- Presidência de comissão permanente
- Coordenação de CPI / Comissão Especial

Endpoint `/senador/{cod}/liderancas.json` + `/senador/{cod}/cargos.json`.

---

## 4. Custo de implementação

| Item | Tempo estimado | Complexidade |
|---|---|---|
| Adicionar fetch de apartes, comissões, lideranças | 30 min | Baixa |
| Pesos por tipo de proposição (Produtividade) | 1 h | Média |
| Status detalhado em Efetividade | 1 h | Média |
| Votações em comissão (Participação) | 1.5 h | Média |
| Ajuste por liderança (Fiscalização) | 30 min | Baixa |
| Cartão corporativo + escritórios + categoria gasto (CEAP) | 1.5 h | Média |
| Apartes na Transparência | 30 min | Baixa |
| **Independência Parlamentar (nova dimensão)** | 2-3 h | **Alta** |
| Atualização do schema D1 | 30 min | Baixa |
| Atualização da página de Metodologia | 1 h | Baixa |
| **Total** | **~10 horas** | |

A dimensão de Independência é a mais cara porque exige cruzar votos individuais com orientação da bancada por sessão — milhares de pares (senador, votação) para 81 senadores. Mas roda no cron offline, então CPU não é bloqueador.

---

## 5. Fases sugeridas de rollout

**Fase 1 — Refinamentos baratos (3-4h)**
- Pesos por tipo de proposição
- Status detalhado em Efetividade
- Apartes na Transparência
- Ajuste por liderança em Fiscalização
- Exibição de "Cargos detidos" no perfil
- Documentação atualizada

**Fase 2 — Comissões + CEAP rico (3h)**
- Votações em comissão (Participação)
- CPI requerimentos (Fiscalização)
- Cartão corporativo + escritórios + perfil de gasto (CEAP)

**Fase 3 — Dimensão de Independência (3h)**
- Coleta de orientação de bancada por sessão
- Cálculo de desvio consciente
- Calibração do sigmoide

Cada fase pode ir ao ar separadamente com versionamento (`IDS v2.0`, `v2.1`, `v2.2`).

---

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Mudança de metodologia confunde usuário | Página `/metodologia` versionada + changelog público |
| Recalibragem altera ranking inteiro | Manter v1 em arquivo (snapshot) acessível via toggle |
| Endpoints lentos quebram cron | Já temos cache KV; ampliar TTL se necessário |
| Independência interpretada como "contra o partido = bom" | Sigmoide com pico em ~10-20% de desvios; documentar |

---

## 7. Recomendação final

Implementar **Fase 1** primeiro (~4 h, ganho expressivo, baixo risco) e avaliar resultados antes de seguir. A Fase 1 sozinha já corrige os problemas mais sérios (P1, P2, P3) e introduz o ajuste por cargo de liderança que torna o ranking estatisticamente defensável.

**Decisão pendente:** o Dani aprova o conjunto, ou prefere ajustar pesos/dimensões antes da implementação?
