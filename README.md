# Pente Fino · auditoria de XML do eSocial

Audita os XMLs do eSocial (leiaute S-1.3) de uma competência **no navegador** e gera um relatório de achados por trabalhador. O XML nunca sai do computador do usuário.

- Especificação: [`docs/arquitetura.md`](docs/arquitetura.md) (a ficha de cada regra, na seção 11, é o contrato).
- Regras de trabalho: [`CLAUDE.md`](CLAUDE.md).
- Pendências do leiaute: [`docs/leiaute/pendencias.md`](docs/leiaute/pendencias.md).

## Como rodar

Node 22.18+ (veja `.nvmrc`).

```sh
npm ci
npm run dev          # app em http://localhost:3000
npm test             # Vitest
npm run test:e2e     # Playwright (rode npm run build antes); PERF=1 inclui o RNF-04 no lote grande
npm run lint         # ESLint, inclusive a fronteira do src/core
npm run typecheck
npm run checar-dados # XML fora de fixtures/ ou CPF válido fora da lista de fictícios
npm run audit -- <pasta|zip|xml> [--competencia AAAA-MM] [--saida <pasta>] [--detalhes]
npm run audit:local  # regressão com os XMLs reais de local-data/ (só local)
```

XMLs reais ficam só em `local-data/` (ignorada pelo git).
