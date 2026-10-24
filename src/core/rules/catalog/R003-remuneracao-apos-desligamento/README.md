# R003 · Remuneração depois do desligamento (Erro)

**Em linguagem de DP:** há folha da competência para quem já saiu. Ex.: desligado em 15/08/2026 e com remuneração de 09/2026 na mesma matrícula.

**Quando aparece:** existe S-2299 no lote com a mesma matrícula e `dtDeslig` anterior ao primeiro dia da competência (no 13º, anterior a 1º de janeiro), e o S-1200 tem `infoPerApur` para essa matrícula.

**Quando não aparece:**

- A remuneração está só em período anterior (`infoPerAnt`): diferenças retroativas são legítimas.
- O desligamento é dentro da competência.
- A matrícula é outra (o mesmo CPF pode ter outro vínculo).
- O demonstrativo é de rescisão (S-2299).

**Como corrigir:** se a verba é rescisória, ela vai no S-2299; excluir ou retificar o S-1200.

**Fixtures:** `dispara.xml` tem S-1200 de 09/2026 da matrícula 0001 e S-2299 com desligamento em 15/08/2026; `limpo.xml` tem o desligamento em 15/09/2026.
