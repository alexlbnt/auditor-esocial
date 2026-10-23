import type { TabelasLeiaute } from '../leiaute/S-1.3/tabelas.ts';
import type { Centavos } from './dinheiro.ts';
import type { ChaveRubrica, Demonstrativo, Rubrica } from './tipos.ts';

export interface Totais {
  proventos: Centavos;
  descontos: Centavos;
  /** proventos − descontos */
  liquido: Centavos;
  /** Rubricas usadas sem S-1010 válido no lote: ficam fora das somas. */
  rubricasSemCadastro: ChaveRubrica[];
  /** Rubricas com `tpRubr` desconhecido pela tabela da versão: também fora das somas. */
  rubricasSemTipo: ChaveRubrica[];
}

/**
 * A única função que soma proventos e descontos (R002, R013, R014 usam ela).
 * Soma todos os grupos do demonstrativo, inclusive diferenças de períodos
 * anteriores: o `vrLiq` do S-1210 é o líquido do demonstrativo inteiro.
 * Informativas não entram.
 */
export function totais(
  demonstrativo: Readonly<Demonstrativo>,
  rubricas: ReadonlyMap<ChaveRubrica, Rubrica>,
  tabelas: TabelasLeiaute,
): Totais {
  let proventos = 0;
  let descontos = 0;
  const semCadastro = new Set<ChaveRubrica>();
  const semTipo = new Set<ChaveRubrica>();
  for (const grupo of demonstrativo.grupos) {
    for (const item of grupo.itens) {
      const rubrica = rubricas.get(item.rubrica);
      if (!rubrica) {
        semCadastro.add(item.rubrica);
        continue;
      }
      const classe = tabelas.tipoRubrica[rubrica.tipo];
      if (classe === 'provento') proventos += item.valor;
      else if (classe === 'desconto') descontos += item.valor;
      else if (!classe) semTipo.add(item.rubrica);
    }
  }
  const ordenar = (s: Set<string>) => [...s].sort();
  return {
    proventos,
    descontos,
    liquido: proventos - descontos,
    rubricasSemCadastro: ordenar(semCadastro),
    rubricasSemTipo: ordenar(semTipo),
  };
}
