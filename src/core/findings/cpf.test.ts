import { describe, expect, it } from 'vitest';
import { cpfTemDvValido, mascararCpf } from './cpf';

describe('cpfTemDvValido', () => {
  it('aceita CPF fictício com DV correto', () => {
    expect(cpfTemDvValido('52998224725')).toBe(true);
  });

  it('recusa DV errado', () => {
    expect(cpfTemDvValido('52998224724')).toBe(false);
    expect(cpfTemDvValido('52998224715')).toBe(false);
  });

  it('recusa os 11 dígitos iguais, mesmo com DV "válido"', () => {
    expect(cpfTemDvValido('00000000000')).toBe(false);
    expect(cpfTemDvValido('11111111111')).toBe(false);
  });

  it('recusa tamanho ou caractere fora do padrão', () => {
    expect(cpfTemDvValido('')).toBe(false);
    expect(cpfTemDvValido('5299822472')).toBe(false);
    expect(cpfTemDvValido('529982247250')).toBe(false);
    expect(cpfTemDvValido('529.982.247-25')).toBe(false);
    expect(cpfTemDvValido('5299822472a')).toBe(false);
  });

  it('trata DV que dá resto 10 como zero', () => {
    // 123.456.789-09: o primeiro DV sai de resto 10 e vira 0.
    expect(cpfTemDvValido('12345678909')).toBe(true);
  });
});

describe('mascararCpf', () => {
  it('mostra só os dígitos do meio', () => {
    expect(mascararCpf('52998224725')).toBe('***.982.247-**');
  });

  it('não devolve nada reconhecível quando a entrada não é CPF', () => {
    expect(mascararCpf('123')).toBe('***.***.***-**');
  });
});
