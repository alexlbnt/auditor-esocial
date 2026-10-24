import { describe, expect, it } from 'vitest';
import { umaAuditoria, umDemonstrativo } from '../../../test/builders/modelo';
import { TABELAS_S_1_3 } from '../leiaute/S-1.3/tabelas';
import { totais } from './totais';

const auditoria = umaAuditoria()
  .comRubrica('1', 'provento')
  .comRubrica('2', 'provento')
  .comRubrica('50', 'desconto')
  .comRubrica('90', 'informativa')
  .comRubrica('91', 'informativaDedutora')
  .construir();
const calcular = (itens: Parameters<typeof umDemonstrativo>[1]) =>
  totais(umDemonstrativo('A', itens), auditoria.rubricas, TABELAS_S_1_3);

describe('totais', () => {
  it('líquido = proventos − descontos, sem informativas', () => {
    expect(
      calcular([
        ['1', 3000_00],
        ['2', 150_00],
        ['50', 330_00],
        ['90', 999_99],
        ['91', 1_00],
      ]),
    ).toEqual({
      proventos: 3150_00,
      descontos: 330_00,
      liquido: 2820_00,
      rubricasSemCadastro: [],
      rubricasSemTipo: [],
    });
  });

  it('soma exata no centavo (sem ponto flutuante)', () => {
    expect(
      calcular([
        ['1', 10],
        ['2', 20],
        ['50', 30],
      ]).liquido,
    ).toBe(0);
  });

  it('rubrica sem cadastro fica fora das somas e é listada uma vez, em ordem', () => {
    const t = calcular([
      ['1', 100_00],
      ['77', 5_00],
      ['33', 1_00],
      ['77', 5_00],
    ]);
    expect(t.proventos).toBe(100_00);
    expect(t.rubricasSemCadastro).toEqual(['33|001', '77|001']);
  });

  it('a tabela da rubrica faz parte da chave', () => {
    expect(calcular([['1', 100_00, '002']]).rubricasSemCadastro).toEqual(['1|002']);
  });

  it('tpRubr desconhecido pela tabela da versão fica fora e é listado', () => {
    const t = totais(umDemonstrativo('A', [['1', 100_00]]), auditoria.rubricas, {
      tipoRubrica: {},
      naturezaIncidencia: [],
    });
    expect(t).toMatchObject({ proventos: 0, rubricasSemTipo: ['1|001'] });
  });

  it('demonstrativo sem itens dá zero', () => {
    expect(calcular([])).toMatchObject({ proventos: 0, descontos: 0, liquido: 0 });
  });

  it('descontos maiores que proventos dão líquido negativo', () => {
    expect(
      calcular([
        ['1', 100_00],
        ['50', 150_00],
      ]).liquido,
    ).toBe(-50_00);
  });

  it('o modelo do construtor é congelado', () => {
    expect(() => (auditoria.rubricas as Map<string, unknown>).set('x', {})).toThrow('congelado');
    expect(Object.isFrozen([...auditoria.rubricas.values()][0])).toBe(true);
  });
});
