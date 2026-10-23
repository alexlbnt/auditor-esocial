# ADR 0001 · Esqueleto do repositório e versões das ferramentas

- **Estado:** aceito
- **Data:** 23/10/2026
- **Etapa:** 0.3

## Contexto

A etapa 0.3 monta o repositório com a stack da seção 4 da arquitetura. Ao instalar, três pontos não estavam fixados no doc.

## Decisões

1. **TypeScript 6.0.3, não 7.x.** O `typescript-eslint` 8.72 (usado pelo `eslint-config-next` 16.4.2) aceita só `typescript >=4.8.4 <6.1.0`. Rever quando o `typescript-eslint` aceitar o TS 7.
2. **ESLint 9.39.5, não 10.x.** O `eslint-plugin-react` 7.37.5 (dependência do `eslint-config-next`) declara suporte até o ESLint 9.
3. **Tailwind 4.3.3**, a estável de 23/10/2026. Todas as versões ficam exatas (`--save-exact`), não só as do `core`.
4. **Scripts em TypeScript rodam com o Node puro** (remoção de tipos nativa do Node 22.18+), sem `tsx`. Por isso `allowImportingTsExtensions` e `erasableSyntaxOnly` estão ligados: nada de `enum` ou `namespace`.
5. **A fronteira do `src/core` tem duas travas:** o ESLint (`no-restricted-imports`, `no-restricted-globals` para DOM e `parseFloat`, `no-restricted-syntax` para `Number()`) e um `tsconfig` próprio sem `lib` DOM e sem tipos do Node. Um teste (`test/fronteira-core.test.ts`) prova que a regra de lint dispara.
6. **Cobertura: 90% de linhas em todo o `src/core`**, o mais rígido entre o RNF-24 e a seção 10.2 (que pedia 80% fora de `rules`).
7. **A fixture do S-1200 anonimizado fica em `test/fixtures/`.** A checagem de dados reais aceita `.xml` em `test/` e em qualquer pasta `fixtures/` (as das regras ficam no catálogo).
8. **A função de DV e a máscara de CPF já nascem em `src/core/findings/cpf.ts`**, porque a checagem de dados reais precisa delas. A R004 e a serialização dos achados vão reusá-las.

## Consequências

- `npm run typecheck` roda o `tsc` duas vezes (app e core).
- A checagem de dados reais olha arquivos versionados e novos ainda não ignorados, para pegar o problema antes do commit. Ela nunca imprime o CPF completo.
