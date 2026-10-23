import { describe, expect, it } from 'vitest';
import { umS1010, umS1200, type S1200Ficticio } from '../../../test/builders/esocial';
import { umId } from '../../../test/builders/xml';
import type { EventoBruto } from '../ingest/tipos';
import { TABELAS_S_1_3 } from '../leiaute/S-1.3/tabelas';
import { lerEventos } from '../parse/S-1.3/index';
import { montarAuditoria, type OpcoesMontagem } from './montar';
import { totais } from './totais';

const CPF_A = '52998224725';
const CPF_B = '12345678909';

let posicao = 0;
function bruto(tipo: EventoBruto['tipo'], xml: string): EventoBruto {
  posicao += 1;
  return {
    arquivo: 'lote.xml',
    posicaoNoLote: posicao,
    tipo,
    leiaute: 'S-1.3',
    namespace: '',
    id: '',
    xml,
  };
}
const s1200 = (s: Partial<S1200Ficticio> & { id?: string }) =>
  bruto(
    'S-1200',
    umS1200({
      dmDev: [
        {
          ideDmDev: 'A',
          grupos: [{ matricula: '1', itens: [{ codRubr: '1', vrRubr: '100.00' }] }],
        },
      ],
      ...s,
    }),
  );
const s1010 = (...args: Parameters<typeof umS1010>) => bruto('S-1010', umS1010(...args));

function montar(eventos: EventoBruto[], opcoes?: OpcoesMontagem) {
  const { lidos, foraDaAuditoria } = lerEventos(eventos);
  expect(foraDaAuditoria).toEqual([]);
  return montarAuditoria(lidos, opcoes);
}
function pronta(eventos: EventoBruto[], opcoes?: OpcoesMontagem) {
  const r = montar(eventos, opcoes);
  if (r.tipo !== 'pronta') throw new Error(r.tipo);
  return r;
}

describe('montarAuditoria: escopo', () => {
  it('sem S-1200 não há o que auditar', () => {
    expect(montar([s1010({ codRubr: '1' })]).tipo).toBe('sem-remuneracao');
  });

  it('mais de um empregador bloqueia e lista as raízes', () => {
    const outro = bruto(
      'S-1010',
      umS1010({ codRubr: '1' }).replace('<nrInsc>11222333</nrInsc>', '<nrInsc>99888777</nrInsc>'),
    );
    expect(montar([s1200({}), outro])).toEqual({
      tipo: 'varios-empregadores',
      raizes: ['11222333', '99888777'],
    });
  });

  it('mais de uma competência pede escolha; a escolhida deixa as outras fora da auditoria', () => {
    const eventos = [
      s1200({ perApur: '2026-09' }),
      s1200({ perApur: '2026-08', cpf: CPF_B }),
      s1200({ perApur: '2026', indApuracao: '2' }),
    ];
    expect(montar(eventos)).toEqual({
      tipo: 'escolher-competencia',
      competencias: ['2026', '2026-08', '2026-09'],
    });
    expect(montar(eventos, { competencia: '2025-01' }).tipo).toBe('escolher-competencia');
    const r = pronta(eventos, { competencia: '2026-09', pacoteXsd: '2026-07-01' });
    expect(r.auditoria).toMatchObject({
      competencia: '2026-09',
      apuracao: 'mensal',
      pacoteXsd: '2026-07-01',
      empregador: { tipoInscricao: '1', raiz: '11222333' },
    });
    expect(r.foraDaAuditoria.map((f) => [f.motivo, f.detalhe])).toEqual([
      ['outra-competencia', '2026-08'],
      ['outra-competencia', '2026'],
    ]);
  });

  it('13º: competência AAAA é apuração anual', () => {
    expect(pronta([s1200({ perApur: '2026', indApuracao: '2' })]).auditoria.apuracao).toBe('anual');
  });
});

describe('montarAuditoria: pessoas e demonstrativos', () => {
  it('monta pessoa por CPF, com demonstrativo, grupos, itens em centavos e origem', () => {
    const r = pronta([
      s1200({
        id: umId(10),
        dmDev: [
          {
            ideDmDev: 'FOLHA-1',
            codCateg: '302',
            grupos: [
              {
                matricula: '0001',
                itens: [
                  { codRubr: '10', vrRubr: '500.00' },
                  { codRubr: '61', vrRubr: '6000.05' },
                ],
              },
            ],
            anteriores: [
              {
                perRef: '2026-08',
                grupos: [{ matricula: '0001', itens: [{ codRubr: '10', vrRubr: '12.30' }] }],
              },
            ],
          },
        ],
      }),
    ]);
    const pessoa = r.auditoria.pessoas.get(CPF_A);
    expect(pessoa?.vinculos).toMatchObject([
      { matricula: '0001', categoria: '302', regime: 'RGPS' },
    ]);
    const [dm] = pessoa?.demonstrativos ?? [];
    expect(dm).toMatchObject({
      id: 'FOLHA-1',
      fonte: 'RGPS',
      categoria: '302',
      periodoReferencia: '2026-09',
    });
    expect(
      dm?.grupos.map((g) => [
        g.matricula,
        g.periodoAnterior,
        g.itens.map((i) => [i.rubrica, i.valor]),
      ]),
    ).toEqual([
      [
        '0001',
        undefined,
        [
          ['10|001', 500_00],
          ['61|001', 6000_05],
        ],
      ],
      ['0001', '2026-08', [['10|001', 12_30]]],
    ]);
    expect(dm?.grupos[0]?.itens[1]?.origem).toEqual({
      arquivo: 'lote.xml',
      posicaoNoLote: expect.any(Number),
      eventoId: umId(10),
      tipo: 'S-1200',
      caminho: 'dmDev[1]/infoPerApur/grupo[1]/itensRemun[2]',
    });
  });

  it('pessoas em ordem de CPF; o mesmo CPF junta demonstrativos de matrículas diferentes', () => {
    const r = pronta([
      s1200({ cpf: CPF_B }),
      s1200({
        cpf: CPF_A,
        dmDev: [
          {
            ideDmDev: 'X',
            grupos: [
              { matricula: '1', itens: [{ codRubr: '1', vrRubr: '1.00' }] },
              { matricula: '2', itens: [{ codRubr: '1', vrRubr: '1.00' }] },
            ],
          },
        ],
      }),
    ]);
    expect([...r.auditoria.pessoas.keys()]).toEqual([CPF_B, CPF_A].sort());
    expect(r.auditoria.pessoas.get(CPF_A)?.vinculos.map((v) => v.matricula)).toEqual(['1', '2']);
  });

  it('retificação: a última do lote vale para os valores; todos ficam em eventos', () => {
    const r = pronta([
      s1200({
        id: umId(1),
        dmDev: [{ ideDmDev: 'A', grupos: [{ itens: [{ codRubr: '1', vrRubr: '100.00' }] }] }],
      }),
      s1200({
        id: umId(2),
        indRetif: '2',
        nrRecibo: '1.1.1',
        dmDev: [{ ideDmDev: 'A', grupos: [{ itens: [{ codRubr: '1', vrRubr: '200.00' }] }] }],
      }),
      s1200({
        id: umId(3),
        indRetif: '2',
        dmDev: [{ ideDmDev: 'A', grupos: [{ itens: [{ codRubr: '1', vrRubr: '300.00' }] }] }],
      }),
    ]);
    expect(
      r.auditoria.eventos.map((e) => [e.origem.eventoId, e.retificacao, e.vigente, e.nrRecibo]),
    ).toEqual([
      [umId(1), false, false, undefined],
      [umId(2), true, false, '1.1.1'],
      [umId(3), true, true, undefined],
    ]);
    const dms = r.auditoria.pessoas.get(CPF_A)?.demonstrativos ?? [];
    expect(dms.map((d) => d.grupos[0]?.itens[0]?.valor)).toEqual([300_00]);
  });

  it('dois originais iguais: o último vale (a R005 aponta a duplicidade)', () => {
    const r = pronta([s1200({ id: umId(1) }), s1200({ id: umId(2) })]);
    expect(r.auditoria.eventos.map((e) => e.vigente)).toEqual([false, true]);
  });
});

describe('montarAuditoria: rubricas (S-1010)', () => {
  const dm = {
    ideDmDev: 'A',
    grupos: [
      {
        itens: [
          { codRubr: '1', vrRubr: '100.00' },
          { codRubr: '2', vrRubr: '30.00' },
        ],
      },
    ],
  };

  it('liga a rubrica ao item e alimenta totais()', () => {
    const r = pronta([
      s1010({ codRubr: '1', tpRubr: '1' }),
      s1010({ codRubr: '2', tpRubr: '2', natRubr: '9201' }),
      s1200({ dmDev: [dm] }),
    ]);
    const rubrica = r.auditoria.rubricas.get('2|001');
    expect(rubrica).toMatchObject({
      codigo: '2',
      tabela: '001',
      natureza: '9201',
      tipo: '2',
      incidencias: { inss: '11', irrf: '11', fgts: '11' },
      validade: { inicio: '2026-01' },
    });
    const demonstrativo = r.auditoria.pessoas.get(CPF_A)?.demonstrativos[0];
    if (!demonstrativo) throw new Error('sem demonstrativo');
    expect(totais(demonstrativo, r.auditoria.rubricas, TABELAS_S_1_3)).toMatchObject({
      proventos: 100_00,
      descontos: 30_00,
      liquido: 70_00,
      rubricasSemCadastro: [],
    });
  });

  it('só vale a validade que cobre a competência', () => {
    const r = pronta([
      s1010({ codRubr: '1', iniValid: '2026-01', fimValid: '2026-08' }),
      s1010({ codRubr: '2', iniValid: '2026-10' }),
      s1010({ codRubr: '3', iniValid: '2026-09', fimValid: '2026-09' }),
      s1200({}),
    ]);
    expect([...r.auditoria.rubricas.keys()]).toEqual(['3|001']);
  });

  it('alteração troca os dados e, com novaValidade, a validade; exclusão remove', () => {
    const r = pronta([
      s1010({ codRubr: '1', tpRubr: '1' }),
      s1010({ codRubr: '1', operacao: 'alteracao', tpRubr: '2' }),
      s1010({ codRubr: '2', iniValid: '2026-01' }),
      s1010({ codRubr: '2', operacao: 'alteracao', novaValidade: { iniValid: '2026-10' } }),
      s1010({ codRubr: '3' }),
      s1010({ codRubr: '3', operacao: 'exclusao' }),
      s1200({}),
    ]);
    expect([...r.auditoria.rubricas.keys()]).toEqual(['1|001']);
    expect(r.auditoria.rubricas.get('1|001')?.tipo).toBe('2');
  });

  it('13º confere a validade em dezembro', () => {
    const r = pronta([
      s1010({ codRubr: '1', iniValid: '2026-12' }),
      s1200({ perApur: '2026', indApuracao: '2' }),
    ]);
    expect(r.auditoria.rubricas.has('1|001')).toBe(true);
  });

  it('S-1010 entra em eventos', () => {
    const r = pronta([s1010({ codRubr: '1' }), s1200({})]);
    expect(r.auditoria.eventos.map((e) => e.origem.tipo)).toEqual(['S-1010', 'S-1200']);
  });
});

describe('montarAuditoria: valores', () => {
  it('valor fora do formato (só sem XSD) tira o evento e vai para fora da auditoria', () => {
    const ruim = bruto(
      'S-1200',
      umS1200({
        dmDev: [{ ideDmDev: 'A', grupos: [{ itens: [{ codRubr: '1', vrRubr: '10,00' }] }] }],
      }),
    );
    const r = pronta([ruim]);
    expect(r.auditoria.pessoas.size).toBe(0);
    expect(r.foraDaAuditoria).toMatchObject([
      { motivo: 'valor-invalido', detalhe: 'S-1200 vrRubr' },
    ]);
  });
});

describe('lerEventos', () => {
  it('evento sem leitor ainda e campo ausente vão para fora da auditoria', () => {
    const r = lerEventos([
      bruto('S-1299', '<eSocial/>'),
      bruto('S-1200', umS1200({ dmDev: [] }).replace(/<cpfTrab>\d+<\/cpfTrab>/, '')),
    ]);
    expect(r.lidos).toEqual([]);
    expect(r.foraDaAuditoria.map((f) => [f.motivo, f.detalhe])).toEqual([
      ['leitura-nao-implementada', 'S-1299'],
      ['leitura-falhou', 'S-1200 ideTrabalhador/cpfTrab'],
    ]);
  });
});
