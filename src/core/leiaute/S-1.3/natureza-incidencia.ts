// Tabela curada da R009: natureza da rubrica (Tabela 03) -> incidências esperadas.
//
// QUEM PREENCHE: o Alex, a partir da Tabela 03 e do MOS (pendência fora do código).
// Começar pelas 20 naturezas mais usadas nos clientes. Cada linha precisa de fonte e
// data. Natureza que não está aqui não gera achado (silêncio, pela ficha da R009).
//
// Formato de uma linha:
//   {
//     natureza: '0000',                         // natRubr, 4 dígitos
//     esperado: { inss: ['..'], irrf: ['..'], fgts: ['..'] }, // códigos aceitos; omitir = não conferir
//     fonte: 'Tabela 03 do leiaute S-1.3 / MOS item ...',
//     data: 'AAAA-MM-DD',
//   },
//
// Nenhuma linha foi inventada: a tabela começa vazia de propósito.
import type { LinhaNaturezaIncidencia } from './tabelas.ts';

export const NATUREZA_INCIDENCIA: readonly LinhaNaturezaIncidencia[] = Object.freeze([]);
