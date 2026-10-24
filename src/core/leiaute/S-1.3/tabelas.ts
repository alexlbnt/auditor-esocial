// Interpretação dos códigos crus do leiaute S-1.3. As regras recebem isto pronto
// (ContextoRegra.tabelas) e nunca importam a tabela da versão diretamente.
import { NATUREZA_INCIDENCIA } from './natureza-incidencia.ts';

export type ClasseRubrica = 'provento' | 'desconto' | 'informativa' | 'informativaDedutora';

/** Uma linha da tabela curada da R009: o que se espera de cada incidência para a natureza. */
export interface LinhaNaturezaIncidencia {
  /** `natRubr` (Tabela 03), 4 dígitos. */
  natureza: string;
  /** Códigos aceitos por incidência; incidência ausente aqui não é conferida. */
  esperado: { inss?: readonly string[]; irrf?: readonly string[]; fgts?: readonly string[] };
  /** De onde veio a linha (Tabela 03, MOS, Nota Técnica...). */
  fonte: string;
  /** Quando a linha foi conferida (AAAA-MM-DD). */
  data: string;
}

export interface TabelasLeiaute {
  /** `tpRubr` do S-1010 -> classe usada por `totais()`. */
  tipoRubrica: Readonly<Record<string, ClasseRubrica>>;
  /** Tabela curada da R009. Natureza fora dela = silêncio. */
  naturezaIncidencia: readonly LinhaNaturezaIncidencia[];
}

/** Enumeração de `tpRubr` no XSD oficial (evtTabRubrica.xsd, pacotes 2026-07-01 e 2026-10-26). */
export const TABELAS_S_1_3: TabelasLeiaute = Object.freeze({
  tipoRubrica: Object.freeze({
    '1': 'provento', // "Vencimento, provento ou pensão"
    '2': 'desconto',
    '3': 'informativa',
    '4': 'informativaDedutora',
  }),
  naturezaIncidencia: NATUREZA_INCIDENCIA,
});
