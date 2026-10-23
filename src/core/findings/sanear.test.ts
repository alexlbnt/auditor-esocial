import { describe, expect, it } from 'vitest';
import { sanearTexto } from './sanear';

describe('sanearTexto', () => {
  it('mascara 11 dígitos seguidos como o CPF', () => {
    expect(sanearTexto('S1200_52998224725.xml')).toBe('S1200_***982247**.xml');
  });

  it('apaga sequências maiores (CNPJ, Id do evento)', () => {
    expect(sanearTexto('ID1112223330000002026102014334200001.xml')).toBe(`ID${'*'.repeat(34)}.xml`);
  });

  it('deixa intacto o que tem menos de 11 dígitos seguidos', () => {
    expect(sanearTexto('lote 2026-09/0001234567.xml')).toBe('lote 2026-09/0001234567.xml');
  });

  it('nunca deixa 11 dígitos seguidos', () => {
    expect(sanearTexto('12345678909 e 123456789012345')).not.toMatch(/\d{11}/);
  });
});
