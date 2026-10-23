import { describe, expect, it } from 'vitest';
import { paraCentavos } from './dinheiro';

describe('paraCentavos', () => {
  it.each([
    ['1234.56', 123456],
    ['0.1', 10],
    ['0.10', 10],
    ['10', 1000],
    ['10.5', 1050],
    ['-3.20', -320],
    ['0', 0],
    ['-0.00', 0],
    ['007.05', 705],
    ['9999999999999.99', 999999999999999],
  ])('"%s" -> %i', (texto, esperado) => {
    expect(paraCentavos(texto)).toBe(esperado);
  });

  it('0.1 + 0.2 fecha exato em centavos', () => {
    expect(paraCentavos('0.1') + paraCentavos('0.2')).toBe(paraCentavos('0.3'));
  });

  it('nunca devolve -0', () => {
    expect(Object.is(paraCentavos('-0'), 0)).toBe(true);
  });

  it.each([
    '',
    ' ',
    '10,50',
    '1.234,56',
    '1.234.56',
    '10.555',
    '.5',
    '5.',
    '+5',
    'abc',
    ' 10',
    '1e3',
  ])('recusa "%s"', (texto) => {
    expect(() => paraCentavos(texto)).toThrow('inválido');
  });

  it('recusa valor além do inteiro seguro', () => {
    expect(() => paraCentavos('99999999999999999.99')).toThrow('fora do limite');
  });
});
