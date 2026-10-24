# ADR 0008 · Saída em CSV, tempo por etapa e regressão local

- **Estado:** aceito
- **Data:** 24/10/2026
- **Etapa:** 1.6 (fecha o Marco 1)

## Decisões

1. **`npm run audit -- <alvo> --saida <pasta>`** grava `achados.csv`, `fora-da-auditoria.csv` e `resumo.txt`. O CSV segue as colunas do Excel da seção 7.4 (severidade, regra, título, CPF mascarado, matrícula, evento, arquivo, campo, esperado, encontrado, diferença, causa), mais `detalhes` (os outros valores) e `chave`.
2. **O CSV passa por `paraEnvio()`**: CPF mascarado e nada com 11 dígitos seguidos, porque na Fase 0 ele vai para pilotos. Formato do Excel em português: `;`, vírgula decimal, BOM e CRLF; texto que começa com `= + - @` ganha `'` na frente (injeção de fórmula vinda do XML).
3. **Número em `valores` é sempre dinheiro em centavos**; contagens (`total` da R001, `pagamentos` e `demonstrativos` da R002) passaram a texto. O lote golden mostra a mudança.
4. **Mensagem enviada (decisão 2 da etapa 1.5):** em `paraEnvio()`, o conteúdo entre aspas simples vira `'…'`, menos nome qualificado do esquema (`'{ns}cpfTrab'` vira `'cpfTrab'`), para o achado continuar dizendo qual campo falhou. Na tela local, a mensagem segue completa.
5. **Tempo por etapa** (`ResultadoAuditoria.tempos`: leitura, xsd, parse, modelo, regras) com relógio injetado; o core continua sem ler o relógio.
6. **`npm run audit:local`** (nível 5, nunca no CI): audita `local-data/` com segredo fixo em `local-data/.segredo` (chave estável), grava em `local-data/.resultado/` e compara pela chave com `local-data/.linha-de-base/` (novos, resolvidos, mudados); sai com erro se algo mudou.

## Medição

Lote fictício "grande" (5.000 trabalhadores, 10.350 eventos, 5.000 achados): **8,7 s** no `audit-cli` (leitura 3,0 · XSD 2,6 · parse 2,6 · modelo 0,3 · regras 0,1 s), CSV de 1,3 MB. Na 1.3b o mesmo lote levou 19 s; a variação entre execuções nesta máquina é alta.
