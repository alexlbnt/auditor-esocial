# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões em SemVer `0.x`.

## [Não lançado]

### Adicionado

- Relatório na tela (etapa 3.2): cabeçalho da auditoria, totais por severidade, trabalhadores sem achado, "Comece por aqui" com a correção que mais resolve, lista por trabalhador (pior severidade primeiro) com a frase de cada achado em linguagem de DP, filtro por severidade, busca por CPF, matrícula ou regra e o bloco "fora da auditoria" detalhado. 10.000 achados rolam e filtram sem travar.
- Auditoria no navegador (etapa 3.1): tela "Nova auditoria" para soltar o .zip ou os XMLs, com a promessa de que os arquivos são lidos no computador, progresso por etapa com contagem e botão de cancelar. A auditoria roda fora da thread da tela; um lote de 5.000 trabalhadores leva cerca de 7 s sem travar a tela.
- Saída em CSV e tempo por etapa (etapa 1.6): `npm run audit -- <alvo> --saida <pasta>` grava achados, fora da auditoria e resumo, com CPF mascarado, prontos para o Excel. `npm run audit:local` compara a auditoria dos XMLs reais com uma linha de base.

### Alterado

- Mensagens do XSD enviadas para fora do navegador não citam mais o valor reprovado; o nome do campo continua.
- Regras R002 (líquido pago diferente do demonstrativo), R003 (remuneração depois do desligamento) e R009 (incidência incoerente com a natureza; a tabela curada começa vazia) (etapa 1.5), com fixtures que disparam e que não disparam, e um lote golden com um erro plantado por regra.
- Motor de regras e achados (etapa 1.4): regras em ordem de código com falha isolada, "regra não executada" sempre listada, achado com chave que identifica o mesmo problema entre auditorias e saída com CPF mascarado. A R001 agora aparece como achado, inclusive quando todos os XMLs são reprovados. `npm run audit` mostra os achados por regra.
- Leitura do S-1210 e do S-2299 (etapa 1.3b): pagamentos ligados ao demonstrativo por CPF + `tpPgto` + `perRef` + `ideDmDev`, regime de caixa (S-1210 de N ou N+1), desligamentos e demonstrativos de rescisão. `npm run audit` mostra pagamentos e desligamentos.
- Leitura do S-1200 e do S-1010 e montagem do modelo por trabalhador (etapa 1.3a): demonstrativos com diferenças de períodos anteriores, tabela de rubricas válida na competência, retificação mais recente para os valores, `totais()` em centavos. `npm run audit` aceita `--competencia` e mostra o resumo do modelo.
- Pacotes XSD oficiais S-1.3 de 01/07/2026 e 26/10/2026 em `schemas/xsd/S-1.3/`; `npm run audit` valida com eles.
- Validação XSD (R001, etapa 1.2): cada evento é validado contra o pacote XSD carregado da memória, com até 5 mensagens e a linha de cada erro. A falta da assinatura digital não reprova o evento (aviso único). `npm run audit` aceita `--pacote AAAA-MM-DD` e `--detalhes`.
- Leitura do lote (etapa 1.1): arquivos .xml soltos e .zip (um nível de zip dentro de zip), envelope do lote ou evento solto, identificação dos sete eventos do MVP pelo namespace e lista do que ficou fora da auditoria.
- Proteção de entrada (RNF-06): recusa zip com mais de 150 MB descompactado, mais de 50.000 arquivos, compressão acima de 100:1 ou XML acima de 10 MB.
- `npm run audit -- <pasta|zip|xml>`: conta os eventos por tipo no terminal.
- Esqueleto do projeto (etapa 0.3): Next.js 16, TypeScript estrito, Tailwind, Vitest com cobertura, ESLint com a fronteira do `src/core`, Prettier e CI no GitHub Actions.
- Checagem de dados reais no CI: falha com `.xml` fora de `fixtures/` ou `test/` e com CPF válido fora da lista de fictícios.
