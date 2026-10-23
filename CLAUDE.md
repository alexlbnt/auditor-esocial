# Pente Fino (Auditor eSocial)

SaaS que audita os XMLs do eSocial (leiaute S-1.3) de uma competência **no navegador** e gera um relatório de achados por trabalhador.
A especificação completa está em `docs/arquitetura.md`. A ficha de cada regra (seção 11 do doc) é o contrato da regra.

## Regras que valem em toda sessão

- Responda em português do Brasil, direto. Recomende uma opção em vez de listar várias. Separe fatos, hipóteses e o que conferir no leiaute.
- **Nunca invente campo, código de tabela ou regra do leiaute.** O que não estiver confirmado leva o comentário `// CONFERIR NO LEIAUTE S-1.3: <campo>` e uma linha em `docs/leiaute/pendencias.md`.
- **O XML nunca sai do navegador.** Para a API vão só achados com CPF mascarado (`***.456.789-**`). O servidor recusa texto com 11 dígitos seguidos.
- **XML real só em `local-data/`** (gitignored). Nunca copie XML real, CPF real ou CNPJ real para fixtures, testes, issues, PRs ou mensagens. Fixtures são fictícias, com dígito verificador válido.
- **Dinheiro em centavos inteiros**, convertido do texto com `paraCentavos()`. Nada de `parseFloat`/`Number()` em valor monetário.
- **`src/core` é puro:** sem React, Next, Prisma ou DOM. A fronteira é checada pelo ESLint.
- Só `totais()` soma proventos e descontos. O modelo é `Readonly`; as regras são puras, síncronas e determinísticas.
- Nada some em silêncio: o que não foi auditado vai para "fora da auditoria".
- Nunca pule, desligue ou enfraqueça teste para deixar o CI verde.
- Não adicione dependência sem perguntar. As versões ficam fixas (Prisma 7.10.1, não a `latest`).

## Como trabalhar

- Uma etapa do plano (seção 6 do doc) por vez, numa branch `etapa/<n>-<nome>`, com PR pequeno e squash merge. `main` sempre verde.
- Pare no fim de cada marco e espere o OK do Alex. Não comece o Marco 3 sem o OK do Marco 2 (validação com o mercado).
- Definição de pronto: testes no nível certo, CI verde, ficha da regra atualizada, `CHANGELOG.md`, decisão registrada no doc.

## Comandos

- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `npm run audit -- <pasta-ou-zip>`: auditoria pelo terminal
- `npm run audit:local`: regressão com os XMLs reais de `local-data/` (só local, nunca no CI)

## Identidade visual (direção B, "marca-texto")

Fundo papel `#FAF8F2`, tinta `#1E1D1A`, secundário `#5C5A53`, linhas `#E5E1D6`, grifo `#FFE45C`, erro `#B3261E`, alerta `#A87A00` (texto `#7A5A00`), informativo `#4A5560`. Fontes Manrope e JetBrains Mono via `next/font`. A severidade é mostrada por cor e forma juntas: Erro = círculo, Alerta = triângulo, Info = quadrado. Siga WCAG 2.1 AA.
