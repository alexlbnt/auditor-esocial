# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões em SemVer `0.x`.

## [Não lançado]

### Adicionado

- Leitura do lote (etapa 1.1): arquivos .xml soltos e .zip (um nível de zip dentro de zip), envelope do lote ou evento solto, identificação dos sete eventos do MVP pelo namespace e lista do que ficou fora da auditoria.
- Proteção de entrada (RNF-06): recusa zip com mais de 150 MB descompactado, mais de 50.000 arquivos, compressão acima de 100:1 ou XML acima de 10 MB.
- `npm run audit -- <pasta|zip|xml>`: conta os eventos por tipo no terminal.
- Esqueleto do projeto (etapa 0.3): Next.js 16, TypeScript estrito, Tailwind, Vitest com cobertura, ESLint com a fronteira do `src/core`, Prettier e CI no GitHub Actions.
- Checagem de dados reais no CI: falha com `.xml` fora de `fixtures/` ou `test/` e com CPF válido fora da lista de fictícios.
