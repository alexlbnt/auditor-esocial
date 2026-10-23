# ADR 0004 · Parse do S-1200 e do S-1010, modelo canônico e totais()

- **Estado:** aceito
- **Data:** 23/10/2026
- **Etapa:** 1.3a

## Decisões

1. **Dinheiro:** `paraCentavos()` aceita só o formato do XSD (ponto decimal, até 2 casas, sinal opcional) e lança `ValorMonetarioInvalido` em qualquer outra coisa (vírgula, vazio, espaço, 3 casas, notação científica). Não há `parseFloat` nem `Number()`; `-0` vira `0`.
2. **Parse:** um leitor do fast-xml-parser por evento, com `parseTagValue: false`, `removeNSPrefix`, atributos com `@_` e `isArray` pela lista de elementos repetíveis tirada do XSD oficial. `jPath: false` porque o `isArray` só olha o nome da tag (cerca de 25% mais rápido). Campo obrigatório ausente lança `ErroDeLeitura` com o caminho; o evento vai para "fora da auditoria" (`leitura-falhou`). Só acontece sem XSD.
3. **O demonstrativo inclui as diferenças de períodos anteriores** (`infoPerAnt`), em grupos com `periodoAnterior`. `totais()` soma tudo, porque o `vrLiq` do S-1210 é o líquido do demonstrativo inteiro. A R003 vai olhar só os grupos sem `periodoAnterior`.
4. **`qtdRubr` e `fatorRubr` ficam como texto** no `ItemRubrica` (o doc sugeria `number`): não são dinheiro, nenhuma regra soma e assim não passam por ponto flutuante.
5. **`Rubrica.tipo` fica cru** (`tpRubr`) e é interpretado por `TABELAS_S_1_3.tipoRubrica`, com a enumeração do XSD oficial. `tpRubr` desconhecido sai das somas e é listado em `rubricasSemTipo`.
6. **Vigência das retificações:** entre os S-1200 do mesmo CPF + `perApur` + `indApuracao`, vale a última retificação do lote; sem retificação, o último original. Só o vigente gera demonstrativos; todos ficam em `eventos` com `vigente` marcado (R005/R006). A ordem é a do lote até a D-10 permitir ordenar pela data/hora do `Id`.
7. **Rubricas por validade:** os S-1010 são aplicados na ordem do lote (inclusão adiciona; alteração troca os dados da validade identificada em `ideRubrica` e, com `novaValidade`, a validade; exclusão remove aquela validade). Vale a validade que cobre a competência; no 13º (`AAAA`), dezembro. As duas regras de semântica estão marcadas para conferir no MOS.
8. **Escopo:** mais de um empregador no lote bloqueia (`varios-empregadores`); mais de uma competência de S-1200 pede escolha (`escolher-competencia`), e os S-1200 das outras competências vão para "fora da auditoria". O `audit-cli` aceita `--competencia`.
9. **`FonteDemonstrativo` = `tpPgto` do S-1210** (D-16): `RGPS` (1, S-1200), `rescisao` (2, S-2299, D-17), `RPPS` (4, S-1202), `beneficio` (5, S-1207).
10. **O resultado da auditoria não carrega mais o XML dos eventos** (`EventoAuditado`), para o texto bruto não ficar em memória depois do parse (RNF-05).

## Medição (Node 24, notebook do Alex, com ruído alto entre execuções)

Lote sintético válido no XSD oficial: 5.000 S-1200 com 40 rubricas e 300 S-1010 (zip de 3,9 MB). Ingest 2,2 a 3,4 s; XSD 3,2 a 7,4 s; parse 5,9 a 6,5 s; montar 0,3 a 0,5 s. O parse é a etapa mais lenta, como o doc previa. **Risco para o RNF-02 no navegador**; medir de novo na 1.6 e, se preciso, ler os dados do mesmo documento que a libxml2 já abriu para validar.
