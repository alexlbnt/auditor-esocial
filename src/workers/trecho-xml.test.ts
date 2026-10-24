import { describe, expect, it } from 'vitest';
import type { Achado } from '@/core/findings/tipos';
import { umS1210 } from '../../test/builders/esocial';
import { comRecuo, trechoDoEvento, umaTagPorLinha } from './trecho-xml';

const achado = (extra: Partial<Achado>): Achado => ({
  regra: 'R002',
  regraVersao: 1,
  severidade: 'erro',
  competencia: '2026-09',
  evento: 'S-1210',
  eventoId: 'ID',
  arquivo: 'lote.xml',
  posicaoNoLote: 1,
  chave: 'x',
  ...extra,
});

const xml = umS1210({
  pagamentos: [
    { ideDmDev: 'A', vrLiq: '100.00' },
    { ideDmDev: 'B', vrLiq: '222.22' },
  ],
});

describe('trecho do XML', () => {
  it('recuo por nível, sem contar declaração e tag que fecha na mesma linha', () => {
    expect(comRecuo(['<?xml?>', '<a>', '<b>1</b>', '<c>', '<d/>', '</c>', '</a>'])).toEqual([
      '<?xml?>',
      '<a>',
      '  <b>1</b>',
      '  <c>',
      '    <d/>',
      '  </c>',
      '</a>',
    ]);
  });

  it('uma tag por linha', () => {
    expect(umaTagPorLinha('<a><b>1</b>\n  <c/></a>')).toEqual(['<a>', '<b>1</b>', '<c/>', '</a>']);
  });

  it('destaca o campo na ocorrência do caminho (infoPgto[2] -> o segundo vrLiq)', () => {
    const t = trechoDoEvento(xml, achado({ campo: 'vrLiq', caminho: 'ideBenef/infoPgto[2]' }), 3);
    expect(t.linhas[t.destaque]?.trimStart()).toBe('<vrLiq>222.22</vrLiq>');
    expect(t.linhas.length).toBeLessThanOrEqual(7);
    expect(t.primeiraLinha).toBeGreaterThan(1);
  });

  it('sem caminho, a primeira ocorrência do campo', () => {
    const t = trechoDoEvento(xml, achado({ campo: 'vrLiq' }));
    expect(t.linhas[t.destaque]?.trimStart()).toBe('<vrLiq>100.00</vrLiq>');
  });

  it('R001: o campo vem da mensagem do XSD', () => {
    const r001 = achado({
      regra: 'R001',
      valores: { erro1: "linha 1, coluna 0: Element '{http://x}cpfBenef': [facet 'pattern'] ..." },
    });
    const t = trechoDoEvento(xml, r001);
    expect(t.linhas[t.destaque]?.trimStart()).toMatch(/^<cpfBenef>/);
  });

  it('campo que não está no XML: sem destaque, começo do evento', () => {
    const t = trechoDoEvento(xml, achado({ campo: 'inexistente' }), 2);
    expect(t).toMatchObject({ destaque: -1, primeiraLinha: 1 });
    expect(t.linhas).toHaveLength(5);
  });
});
