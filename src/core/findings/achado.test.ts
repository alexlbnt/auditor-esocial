import { describe, expect, it } from 'vitest';
import { chaveDoAchado } from './chave';
import { paraEnvio } from './envio';
import type { Achado } from './tipos';

const SEGREDO = new TextEncoder().encode('segredo-de-teste');
const OUTRO = new TextEncoder().encode('outro-segredo');
const partes = { regra: 'R002', cpf: '52998224725', campo: 'vrLiq', competencia: '2026-09' };

describe('chaveDoAchado', () => {
  it('é determinística e depende do segredo', () => {
    expect(chaveDoAchado(SEGREDO, partes)).toBe(chaveDoAchado(SEGREDO, partes));
    expect(chaveDoAchado(SEGREDO, partes)).not.toBe(chaveDoAchado(OUTRO, partes));
  });

  it('muda com cada parte, inclusive o discriminador', () => {
    const base = chaveDoAchado(SEGREDO, partes);
    for (const troca of [
      { regra: 'R003' },
      { cpf: '12345678909' },
      { campo: 'x' },
      { competencia: '2026-10' },
      { discriminador: 'A' },
    ]) {
      expect(chaveDoAchado(SEGREDO, { ...partes, ...troca })).not.toBe(base);
    }
  });

  it('partes vazias não colidem por concatenação', () => {
    const a = chaveDoAchado(SEGREDO, { regra: 'R1', campo: '2', competencia: 'c' });
    const b = chaveDoAchado(SEGREDO, { regra: 'R12', competencia: 'c' });
    expect(a).not.toBe(b);
  });

  it('só letras: nunca 11 dígitos seguidos', () => {
    for (let i = 0; i < 200; i++) {
      const chave = chaveDoAchado(SEGREDO, { ...partes, discriminador: String(i) });
      expect(chave).toMatch(/^[a-zA-F]{52}$/);
    }
  });
});

describe('paraEnvio', () => {
  const achado: Achado = {
    regra: 'R002',
    regraVersao: 1,
    severidade: 'erro',
    competencia: '2026-09',
    cpf: '52998224725',
    matricula: '0001',
    evento: 'S-1210',
    eventoId: 'ID1112223330000002026102014334200001',
    arquivo: 'S1210_52998224725.xml',
    posicaoNoLote: 1,
    campo: 'vrLiq',
    valores: {
      esperado: 315000,
      encontrado: 321000,
      nota: 'CPF 52998224725',
      grande: 12345678901234,
    },
    causa: 'rubrica:1050|001',
    chave: chaveDoAchado(SEGREDO, partes),
  };

  it('mascara o CPF e saneia nome de arquivo, Id e textos', () => {
    const saida = paraEnvio(achado);
    expect(saida).toMatchObject({
      cpfMascarado: '***.982.247-**',
      arquivo: 'S1210_***982247**.xml',
      eventoId: `ID${'*'.repeat(34)}`,
      valores: {
        esperado: 315000,
        encontrado: 321000,
        nota: 'CPF ***982247**',
        grande: '*'.repeat(14),
      },
    });
    expect(saida).not.toHaveProperty('cpf');
    expect(saida).not.toHaveProperty('competencia');
    expect(JSON.stringify(saida)).not.toMatch(/\d{11}/);
  });

  it('não leva textos da regra nem o caminho no XML', () => {
    expect(Object.keys(paraEnvio(achado)).sort()).toEqual([
      'arquivo',
      'campo',
      'causa',
      'chave',
      'cpfMascarado',
      'evento',
      'eventoId',
      'matricula',
      'regra',
      'regraVersao',
      'severidade',
      'valores',
    ]);
  });

  it('recusa se sobrar 11 dígitos em algum lugar (última trava)', () => {
    expect(() => paraEnvio({ ...achado, chave: '12345678901' })).toThrow('11 dígitos');
  });
});
