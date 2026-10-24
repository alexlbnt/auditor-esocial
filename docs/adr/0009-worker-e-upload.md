# ADR 0009 · Auditoria no navegador: Web Worker, upload, progresso e cancelar

- **Estado:** aceito
- **Data:** 24/10/2026
- **Etapa:** 3.1 (Marco 3, com OK do Marco 2 dado pelo Alex em 24/10/2026)

## Decisões

1. **O core roda num Web Worker de módulo** (`src/workers/audit.worker.ts`) com comlink 4.4.2. A tela (`features/audit-run/useAuditoria.ts`) só passa os objetos `File`; o worker lê os bytes, então a thread da tela não toca no conteúdo dos XMLs.
2. **Cancelar = `worker.terminate()`**: imediato e sem tocar no core. A próxima auditoria usa um worker novo, que já começa a preparar o XSD. Respostas de um worker encerrado são ignoradas por um contador de geração.
3. **Progresso:** o core ganhou `aoProgredir` (etapas lendo, validando, montando, auditando; item a item). O worker limita o envio para a tela a uma mensagem a cada 150 ms, mas sempre repassa a troca de etapa e o fim de cada uma (`limitarProgresso`).
4. **XSD no navegador:** `scripts/gerar-xsd-web.ts` (em `predev`/`prebuild`) junta cada pacote num JSON em `public/xsd/S-1.3/` (gitignored), servido pelo próprio site. O worker baixa e compila o pacote **quando a tela de upload abre**, não ao auditar, para a auditoria funcionar offline depois que a página carregou (RNF-16). A auditoria espera essa preparação: arquivos soltos antes dela não são auditados sem XSD. D-09 segue em aberto: o pacote mais recente.
5. **A libxml2-wasm é importada sob demanda dentro do worker.** Fato encontrado nesta etapa: ela carrega o WebAssembly com top-level await (`lib/libxml2.mjs`, linha 3). Importada no topo do worker, atrasava o `Comlink.expose` e a primeira mensagem da tela se perdia (o validador nunca ficava pronto). Sob demanda, o expose é imediato e o wasm fica fora da carga inicial (RNF-25).
6. **O worker devolve um resumo** (`workers/resumo.ts`), sem o texto dos XMLs (RNF-05). A tela da 3.1 mostra um resumo provisório (cabeçalho, totais por severidade com forma, trabalhadores sem achado, fora da auditoria, escolha de competência, lote recusado); o relatório completo é a 3.2.
7. **Segredo da chave:** aleatório por worker (`crypto.getRandomValues`), já que sem login a chave vale só na sessão.
8. **Testes de ponta a ponta com Playwright** (`test/e2e/`), num job próprio do CI (Chromium): fluxo completo e cancelar em até 1 s. O teste do RNF-04 no lote grande roda só com `PERF=1` e entra no CI na 3.6. Ele passa o lote **pelo caminho no disco**: com `buffer`, o próprio Playwright copia os bytes para a página na thread da tela e gera uma tarefa longa (~740 ms) que não é do app (medido).

## Medição (Chromium do Playwright, notebook do Alex)

Lote fictício "grande": 5.000 trabalhadores, 10.300 eventos (S-1200 com 40 rubricas, S-1210, 300 S-1010), zip de ~6 MB. Do arquivo solto ao resumo na tela: **6,5 s**. Thread da tela: **nenhuma tarefa longa** (> 50 ms). Maior intervalo sem atualizar o progresso: **~390 ms**. Cancelar volta à tela inicial em menos de 1 s. RNF-04 e RNF-02 atendidos neste perfil.

## Confirmado

A hipótese do item 4 do doc ("a libxml2-wasm funciona dentro de um Web Worker no Next.js 16 com Turbopack") vale, com a importação sob demanda acima.

## Atualização em 24/10/2026 (etapa 3.3): corrida entre o último progresso e a resposta

O CI pegou a tela parada em "Auditando as regras · 4 de 4" com a auditoria já terminada. O último progresso e a resposta final chegam por mensagens separadas do comlink, e às vezes a resposta vem primeiro; o progresso atrasado sobrescrevia o estado "concluída". Agora `useAuditoria` ignora progresso que chega depois da resposta (ou do erro). Verificado repetindo o e2e 3 vezes (15 de 15).
