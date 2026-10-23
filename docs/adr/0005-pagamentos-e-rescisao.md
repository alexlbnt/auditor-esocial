# ADR 0005 · S-1210 e S-2299 no modelo

- **Estado:** aceito
- **Data:** 23/10/2026
- **Etapa:** 1.3b
- **Decisões de produto:** D-16 e D-17 (Alex, 23/10/2026)

## Decisões

1. **Pagamento** = cada `infoPgto` do S-1210, com `tpPgto` cru (`tipoPagamento`), `perRef`, `ideDmDev` e `vrLiq` em centavos. A pessoa é a do `cpfBenef`; quem tem pagamento sem S-1200 no lote também vira Pessoa (a R011 precisa ver).
2. **Regime de caixa:** a auditoria de N aceita S-1210 com `perApur` N ou N+1; no 13º (AAAA), os meses de AAAA e janeiro de AAAA+1 (hipótese marcada para conferir). S-1210 fora dessa janela vai para "fora da auditoria" (`outra-competencia`).
3. **`tpPgto` = 3 (S-2399, TSV)** fica fora do MVP: aquele `infoPgto` vai para "fora da auditoria"; os outros pagamentos do mesmo evento seguem.
4. **S-2299 é não periódico:** todos os do lote entram como Desligamento (a R003 precisa de desligamentos de meses anteriores). Os **demonstrativos de rescisão** (`verbasResc/dmDev`, `fonte: 'rescisao'`) só entram quando o desligamento é da competência auditada, com `periodoReferencia` = mês do `dtDeslig` (é o `perRef` que o S-1210 usa com `tpPgto` = 2); os de outro mês vão para "fora da auditoria". A matrícula dos grupos vem do `ideVinculo`.
5. **Vigência:** a mesma regra do S-1200 (última retificação do lote), com chave CPF + `perApur` no S-1210 e CPF + matrícula no S-2299.
6. Valor fora do formato (só sem XSD) tira o evento inteiro e vai para "fora da auditoria" (`valor-invalido`), para não haver evento pela metade no modelo.

## Medição

Lote fictício do perfil "grande": 5.000 trabalhadores, 10.350 eventos (S-1200 com 40 rubricas, S-1210 pago em N+1, 300 S-1010, 50 S-2299 com rescisão), zip de ~6 MB: **19,1 s** no `audit-cli` (Node 24, notebook do Alex). Dentro dos 60 s do RNF-02, mas o navegador pode ser até 3 vezes mais lento: medir no worker no Marco 3.
