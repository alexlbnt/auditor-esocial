# R002 · Líquido pago diferente do demonstrativo (Erro)

**Em linguagem de DP:** o S-1210 diz que pagou um valor, mas o demonstrativo (proventos menos descontos) fecha em outro. Ex.: "O S-1210 pagou R$ 2.880,00, mas o demonstrativo fecha em R$ 2.820,00. Diferença de R$ 60,00."

**Como liga o pagamento ao demonstrativo (D-16):** CPF + `tpPgto` + `perRef` + `ideDmDev`. O `tpPgto` diz de onde vem o demonstrativo: 1 = S-1200, 2 = S-2299 (rescisão, D-17), 4 = S-1202, 5 = S-1207. Soma todos os `infoPgto` do mesmo demonstrativo. O líquido esperado vem de `totais()`, sobre o demonstrativo inteiro (inclusive diferenças de períodos anteriores).

**Quando não aparece:**

- O demonstrativo não tem pagamento no lote (isso é a R011).
- Nenhum S-1210 no lote: em vez de um achado por trabalhador, um único Info ("pagamentos não enviados").
- Nenhum S-1010 no lote: um único Info ("tabela de rubricas não enviada"), porque sem `tpRubr` não dá para saber o que é provento ou desconto.

**Severidade:** Erro. Rebaixa para Alerta quando alguma rubrica do demonstrativo não tem S-1010 válido (ou tem `tpRubr` desconhecido); a causa aponta a rubrica quando é uma só.

**Como corrigir:** procurar rubrica paga fora da folha, adiantamento não descontado ou pagamento lançado no demonstrativo errado; retificar o evento errado.

**Fixtures:** `dispara.xml` tem S-1010 das rubricas 1, 2 e 50, um S-1200 que fecha em 2.820,00 e um S-1210 (pago em 10/2026) de 2.880,00; `limpo.xml` tem o mesmo com o S-1210 de 2.820,00.
