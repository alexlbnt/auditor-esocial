// Tabela FICTÍCIA, só para os testes da R009 (unidade, contrato e lote golden).
// NÃO é a tabela curada: os códigos esperados aqui não foram conferidos em
// Tabela 03 nem no MOS. A tabela real fica em core/leiaute/S-1.3/natureza-incidencia.ts.
import { TABELAS_S_1_3, type TabelasLeiaute } from '../../../../leiaute/S-1.3/tabelas.ts';

export const TABELAS_FICTICIAS: TabelasLeiaute = Object.freeze({
  ...TABELAS_S_1_3,
  naturezaIncidencia: Object.freeze([
    {
      natureza: '1000',
      esperado: { inss: ['11'], irrf: ['11'] },
      fonte: 'FICTÍCIA (teste)',
      data: '2026-10-24',
    },
  ]),
});

/** Usado pelo teste de contrato ao rodar dispara.xml e limpo.xml. */
export const tabelas = TABELAS_FICTICIAS;
