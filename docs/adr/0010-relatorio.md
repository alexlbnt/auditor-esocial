# ADR 0010 · Relatório na tela (HU-02)

- **Estado:** aceito
- **Data:** 24/10/2026
- **Etapa:** 3.2

## Decisões

1. **A lógica fica fora do React** (`features/report/modelo-relatorio.ts`): agrupar por trabalhador, ordenar pela pior severidade e pela quantidade de achados, filtrar por severidade e busca, escolher o "Comece por aqui". Testada no Vitest, inclusive o RNF-07 (10.000 achados filtrados em menos de 300 ms, espalhados e num grupo só).
2. **Achados sem CPF** (R001, R009, os avisos únicos da R002) ficam no grupo "Lote e cadastros".
3. **A frase do achado é montada na tela** (`frases.ts`) a partir dos `valores`, em linguagem de DP e com dinheiro formatado só por aritmética de inteiros. Regra sem frase própria mostra o título.
4. **Busca:** CPF (3 dígitos ou mais, com ou sem pontuação), matrícula ou código de regra (`R002`). Não há busca por nome: o S-1200 não traz nome (D-15). Na tela, o CPF aparece mascarado, como no resto do produto; a busca usa o CPF completo, que só existe na memória do navegador.
5. **"Comece por aqui"** mostra a causa com mais achados; sem causa repetida, a regra com mais achados da maior severidade. **Só aparece se a correção resolve 2 achados ou mais**: com um de cada, o cartão não ajuda e some.
6. **Lista virtualizada própria** (`shared/ui/ListaVirtual.tsx`, sem dependência nova): linhas de altura fixa (56 px, alvo ≥ 44 px), um vetor achatado com o cabeçalho do grupo e os achados, `role="list"` com `aria-setsize`/`aria-posinset`. A busca usa `useDeferredValue` para a digitação não esperar o filtro.
7. **Celular (RNF-11, 360 px):** a lista esconde o código do evento e a contagem do grupo; a frase completa fica no cartão do achado (3.3).

## Medição (Chromium do Playwright)

10.000 achados (lote fictício de 10.000 trabalhadores com líquido diferente): do upload ao filtro, maior tarefa na thread da tela de **57 ms** (inclui a chegada e a primeira renderização dos achados); filtro por severidade respondendo em **120 a 154 ms** (com as idas e voltas do Playwright). RNF-07 atendido. O RNF-04 continua: 7,5 s no lote grande, sem tarefa longa.
