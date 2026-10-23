// Interpretação dos códigos crus do leiaute S-1.3. As regras recebem isto pronto
// (ContextoRegra.tabelas) e nunca importam a tabela da versão diretamente.

export type ClasseRubrica = 'provento' | 'desconto' | 'informativa' | 'informativaDedutora';

export interface TabelasLeiaute {
  /** `tpRubr` do S-1010 -> classe usada por `totais()`. */
  tipoRubrica: Readonly<Record<string, ClasseRubrica>>;
}

/** Enumeração de `tpRubr` no XSD oficial (evtTabRubrica.xsd, pacotes 2026-07-01 e 2026-10-26). */
export const TABELAS_S_1_3: TabelasLeiaute = Object.freeze({
  tipoRubrica: Object.freeze({
    '1': 'provento', // "Vencimento, provento ou pensão"
    '2': 'desconto',
    '3': 'informativa',
    '4': 'informativaDedutora',
  }),
});
