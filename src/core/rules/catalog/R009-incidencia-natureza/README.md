# R009 · Incidência incoerente com a natureza (Alerta)

**Em linguagem de DP:** a rubrica tem uma natureza (Tabela 03) que pede uma incidência de INSS, IRRF ou FGTS, mas o S-1010 informa outra. Ex.: natureza de salário com `codIncCP` "não é base de cálculo".

**Como decide:** pela **tabela curada** `src/core/leiaute/S-1.3/natureza-incidencia.ts` (natureza → códigos aceitos por incidência, com fonte e data em cada linha), que o Alex monta a partir da Tabela 03 e do MOS. A regra recebe a tabela por `ctx.tabelas` e não importa nada.

**Quando não aparece:**

- A natureza não está na tabela curada (silêncio). **A tabela começa vazia**, então a regra não dispara até ser preenchida.
- A linha não confere aquela incidência.
- Não há S-1010 no lote (a R008 avisa).

**Um achado por rubrica e incidência**, todos com a causa `rubrica:<código>|<tabela>`: corrigir a rubrica resolve todos.

**Como corrigir:** revisar a incidência no S-1010; se for exceção legítima (decisão judicial), ignorar com motivo.

**Fixtures:** usam a tabela **fictícia** de `fixtures/contexto.ts` (natureza 1000 espera `codIncCP` 11). `dispara.xml` tem a rubrica 1 com `codIncCP` 00; `limpo.xml`, com 11.
