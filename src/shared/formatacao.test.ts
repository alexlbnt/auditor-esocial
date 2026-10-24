import { describe, expect, it } from 'vitest';
import { formatarCompetencia, formatarQuantidade, formatarReais } from './formatacao';

describe('formatação', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [282000, 'R$ 2.820,00'],
    [-6000, '-R$ 60,00'],
    [123456789, 'R$ 1.234.567,89'],
  ])('formatarReais(%i) = %s', (centavos, texto) => {
    expect(formatarReais(centavos)).toBe(texto);
  });

  it('quantidade com separador de milhar', () => {
    expect(formatarQuantidade(10350)).toBe('10.350');
    expect(formatarQuantidade(7)).toBe('7');
  });

  it('competência mensal e 13º', () => {
    expect(formatarCompetencia('2026-09')).toBe('09/2026');
    expect(formatarCompetencia('2026')).toBe('13º de 2026');
  });
});
