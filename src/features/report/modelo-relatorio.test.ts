import { describe, expect, it } from 'vitest';
import type { Achado, Severidade } from '@/core/findings/tipos';
import { fraseDoAchado } from './frases';
import {
  agruparPorCausa,
  agruparPorRegra,
  agruparPorTrabalhador,
  comecePorAqui,
  GRUPO_DO_LOTE,
  GRUPO_SEM_CAUSA,
  linhasFiltradas,
} from './modelo-relatorio';

let n = 0;
function achado(regra: string, severidade: Severidade, extra: Partial<Achado> = {}): Achado {
  n += 1;
  return {
    regra,
    regraVersao: 1,
    severidade,
    competencia: '2026-09',
    evento: 'S-1200',
    eventoId: `ID-${n}`,
    arquivo: 'lote.xml',
    posicaoNoLote: n,
    chave: `chave${n}`,
    ...extra,
  };
}
const A = '52998224725';
const B = '12345678909';
const TODAS = new Set<Severidade>(['erro', 'alerta', 'info']);

describe('agruparPorTrabalhador', () => {
  const achados = [
    achado('R009', 'alerta', { causa: 'rubrica:7|001' }),
    achado('R002', 'alerta', { cpf: B }),
    achado('R003', 'erro', { cpf: A }),
    achado('R002', 'erro', { cpf: A }),
    achado('R001', 'erro'),
  ];
  const grupos = agruparPorTrabalhador(achados, [
    { cpf: A, matriculas: ['0001'] },
    { cpf: B, matriculas: ['0002'] },
  ]);

  it('ordena pela pior severidade, depois pela quantidade de achados', () => {
    expect(grupos.map((g) => [g.rotulo, g.pior, g.achados.length])).toEqual([
      ['***.982.247-**', 'erro', 2],
      ['Lote e cadastros', 'erro', 2],
      ['***.456.789-**', 'alerta', 1],
    ]);
  });

  it('dentro do grupo, mais grave primeiro e depois por regra', () => {
    expect(grupos[0]?.achados.map((a) => a.regra)).toEqual(['R002', 'R003']);
    expect(grupos[1]?.achados.map((a) => a.regra)).toEqual(['R001', 'R009']);
  });

  it('o CPF aparece mascarado; a matrícula vem do trabalhador', () => {
    expect(grupos[0]).toMatchObject({ id: A, rotulo: '***.982.247-**', matriculas: ['0001'] });
    expect(grupos[1]?.id).toBe(GRUPO_DO_LOTE);
  });

  it('filtra por severidade e mostra quantos achados ficaram visíveis', () => {
    const linhas = linhasFiltradas(grupos, { severidades: new Set(['alerta']), busca: '' });
    expect(
      linhas.map((l) =>
        l.tipo === 'grupo' ? `G ${l.grupo.rotulo} ${l.visiveis}` : `  ${l.achado.regra}`,
      ),
    ).toEqual(['G Lote e cadastros 1', '  R009', 'G ***.456.789-** 1', '  R002']);
  });

  it('busca por CPF (com ou sem pontuação), matrícula ou regra', () => {
    const grupoDe = (busca: string) =>
      linhasFiltradas(grupos, { severidades: TODAS, busca })
        .filter((l) => l.tipo === 'grupo')
        .map((l) => (l.tipo === 'grupo' ? l.grupo.id : ''));
    expect(grupoDe('529.982')).toEqual([A]);
    expect(grupoDe('0002')).toEqual([B]);
    expect(grupoDe('r003')).toEqual([A]);
    expect(grupoDe('R002')).toEqual([A, B]);
    expect(grupoDe('nada')).toEqual([]);
  });

  it('RNF-07: filtra 10.000 achados em menos de 300 ms', () => {
    const muitos = Array.from({ length: 10_000 }, (_, i) =>
      achado(i % 3 ? 'R002' : 'R003', i % 2 ? 'erro' : 'alerta', {
        cpf: String(10_000_000_000 + (i % 4000)),
      }),
    );
    const trabalhadores = Array.from({ length: 4000 }, (_, i) => ({
      cpf: String(10_000_000_000 + i),
      matriculas: [String(i)],
    }));
    const inicio = performance.now();
    const g = agruparPorTrabalhador(muitos, trabalhadores);
    linhasFiltradas(g, { severidades: TODAS, busca: '123' });
    linhasFiltradas(g, { severidades: new Set(['erro']), busca: 'r002' });
    expect(performance.now() - inicio).toBeLessThan(300);
  });

  it('RNF-07: 10.000 achados num grupo só (ex.: todos do lote) também em menos de 300 ms', () => {
    const muitos = Array.from({ length: 10_000 }, () =>
      achado('R009', 'alerta', { causa: 'rubrica:1|001' }),
    );
    const inicio = performance.now();
    const g = agruparPorTrabalhador(muitos, []);
    linhasFiltradas(g, { severidades: TODAS, busca: '' });
    comecePorAqui(muitos);
    expect(performance.now() - inicio).toBeLessThan(300);
  });
});

describe('comecePorAqui', () => {
  it('a causa com mais achados', () => {
    const r = comecePorAqui([
      achado('R009', 'alerta', { causa: 'rubrica:1|001' }),
      achado('R009', 'alerta', { causa: 'rubrica:2|001' }),
      achado('R002', 'alerta', { causa: 'rubrica:2|001', cpf: A }),
      achado('R003', 'erro', { cpf: A }),
    ]);
    expect(r).toEqual({ tipo: 'causa', causa: 'rubrica:2|001', quantidade: 2, regra: 'R009' });
  });

  it('sem causa repetida, a regra com mais achados da maior severidade', () => {
    const r = comecePorAqui([
      achado('R003', 'erro', { cpf: A }),
      achado('R002', 'erro', { cpf: A }),
      achado('R002', 'erro', { cpf: B }),
      achado('R009', 'alerta'),
    ]);
    expect(r).toEqual({ tipo: 'regra', regra: 'R002', quantidade: 2, severidade: 'erro' });
  });

  it('sem achados, ou quando resolveria 1 achado só, nada', () => {
    expect(comecePorAqui([])).toBeUndefined();
    const umDeCada = [
      achado('R001', 'erro'),
      achado('R002', 'erro', { cpf: A }),
      achado('R003', 'erro', { cpf: B }),
    ];
    expect(comecePorAqui(umDeCada)).toBeUndefined();
  });
});

describe('fraseDoAchado', () => {
  it.each([
    [
      achado('R002', 'erro', {
        valores: { esperado: 282000, encontrado: 288000, diferenca: 6000 },
      }),
      'O S-1210 pagou R$ 2.880,00, mas o demonstrativo fecha em R$ 2.820,00. Diferença de R$ 60,00.',
    ],
    [
      achado('R002', 'erro', {
        valores: { esperado: 100000, encontrado: 99900, diferenca: -100 },
      }),
      'O S-1210 pagou R$ 999,00, mas o demonstrativo fecha em R$ 1.000,00. Diferença de R$ 1,00 a menos.',
    ],
    [
      achado('R002', 'alerta', { valores: { encontrado: 100, rubricasSemCadastro: '77|001' } }),
      'O S-1210 pagou R$ 1,00, mas não deu para conferir: rubrica 77 (tabela 001) sem cadastro no S-1010.',
    ],
    [
      achado('R002', 'info', { valores: { motivo: 'sem-S-1210', demonstrativos: '3' } }),
      'Nenhum S-1210 no lote: os líquidos de 3 demonstrativo(s) não foram conferidos.',
    ],
    [
      achado('R003', 'erro', {
        valores: { dataDesligamento: '2026-08-15', competencia: '2026-09' },
      }),
      'Desligado em 15/08/2026, mas tem folha de 09/2026.',
    ],
    [
      achado('R001', 'erro', { valores: { total: '2' } }),
      'O XML não segue o esquema do eSocial: 2 erro(s) de estrutura.',
    ],
    [
      achado('R009', 'alerta', {
        campo: 'codIncCP',
        valores: { rubrica: '7|001', natureza: '1000', encontrado: '00', esperado: '11' },
      }),
      'A rubrica 7 (tabela 001) está com codIncCP 00; para a natureza 1000 o esperado é 11.',
    ],
    [achado('R099', 'info'), 'Título da regra'],
  ])('%#', (a, frase) => {
    expect(fraseDoAchado(a, 'Título da regra')).toBe(frase);
  });
});

describe('HU-04: visões por regra e por causa', () => {
  const achados = [
    achado('R002', 'erro', { cpf: A }),
    achado('R002', 'erro', { cpf: B }),
    achado('R002', 'alerta', { cpf: B, causa: 'rubrica:77|001' }),
    achado('R009', 'alerta', { causa: 'rubrica:77|001' }),
    achado('R009', 'alerta', { causa: 'rubrica:8|001' }),
    achado('R003', 'erro', { cpf: A, matricula: '0001' }),
  ];

  it('por regra: uma linha por regra, pior severidade e depois a mais frequente', () => {
    const grupos = agruparPorRegra(achados, (c) => `Título ${c}`);
    expect(grupos.map((g) => [g.id, g.rotulo, g.achados.length, g.pior])).toEqual([
      ['R002', 'R002 · Título R002', 3, 'erro'],
      ['R003', 'R003 · Título R003', 1, 'erro'],
      ['R009', 'R009 · Título R009', 2, 'alerta'],
    ]);
  });

  it('por causa: da que mais resolve para a que menos; sem causa no fim', () => {
    const grupos = agruparPorCausa(achados, (c) => `Corrija ${c}`);
    expect(grupos.map((g) => [g.id, g.achados.length])).toEqual([
      ['rubrica:77|001', 2],
      ['rubrica:8|001', 1],
      [GRUPO_SEM_CAUSA, 3],
    ]);
    expect(grupos.at(-1)?.rotulo).toBe('Achados sem causa comum');
    expect(grupos[0]?.achados.map((a) => a.regra)).toEqual(['R002', 'R009']);
  });

  it('a busca olha cada achado, então CPF e matrícula funcionam nas visões por regra e causa', () => {
    const porRegra = agruparPorRegra(achados, (c) => c);
    const deA = linhasFiltradas(porRegra, { severidades: TODAS, busca: '529.982' });
    expect(
      deA
        .filter((l) => l.tipo === 'achado')
        .map((l) => (l.tipo === 'achado' ? l.achado.regra : '')),
    ).toEqual(['R002', 'R003']);
    const matricula = linhasFiltradas(porRegra, { severidades: TODAS, busca: '0001' });
    expect(matricula.filter((l) => l.tipo === 'achado')).toHaveLength(1);
    const porCausa = agruparPorCausa(achados, (c) => c);
    const r009 = linhasFiltradas(porCausa, { severidades: TODAS, busca: 'r009' });
    expect(
      r009
        .filter((l) => l.tipo === 'grupo')
        .map((l) => (l.tipo === 'grupo' ? `${l.grupo.id}:${l.visiveis}` : '')),
    ).toEqual(['rubrica:77|001:1', 'rubrica:8|001:1']);
  });
});
