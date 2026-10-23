// Etapa 1.3b: S-1210 (pagamentos, D-16) e S-2299 (desligamento e rescisão, D-17).
import { describe, expect, it } from 'vitest';
import { umS1010, umS1200, umS1210, umS2299 } from '../../../test/builders/esocial';
import { umId } from '../../../test/builders/xml';
import type { EventoBruto } from '../ingest/tipos';
import { TABELAS_S_1_3 } from '../leiaute/S-1.3/tabelas';
import { lerEventos } from '../parse/S-1.3/index';
import { mesSeguinte, periodosDePagamento } from './competencia';
import { montarAuditoria, type OpcoesMontagem } from './montar';
import { totais } from './totais';

const CPF = '52998224725';
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
const folha = (perApur = '2026-09') =>
  bruto(
    'S-1200',
    umS1200({
      perApur,
      dmDev: [
        {
          ideDmDev: 'A',
          grupos: [{ matricula: '0001', itens: [{ codRubr: '1', vrRubr: '3000.00' }] }],
        },
      ],
    }),
  );
function pronta(eventos: EventoBruto[], opcoes?: OpcoesMontagem) {
  const { lidos, foraDaAuditoria } = lerEventos(eventos);
  expect(foraDaAuditoria).toEqual([]);
  const r = montarAuditoria(lidos, opcoes);
  if (r.tipo !== 'pronta') throw new Error(r.tipo);
  return r;
}

describe('competência', () => {
  it('mês seguinte, inclusive na virada do ano', () => {
    expect(mesSeguinte('2026-09')).toBe('2026-10');
    expect(mesSeguinte('2026-12')).toBe('2027-01');
  });

  it('pagamento da folha mensal: perApur N ou N+1', () => {
    const aceita = periodosDePagamento('2026-12');
    expect(['2026-11', '2026-12', '2027-01', '2027-02'].map(aceita)).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it('pagamento do 13º: meses do ano e janeiro seguinte', () => {
    const aceita = periodosDePagamento('2026');
    expect(['2025-12', '2026-01', '2026-12', '2027-01', '2027-02'].map(aceita)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
  });
});

describe('S-1210 no modelo', () => {
  it('cada infoPgto vira um Pagamento da pessoa, em centavos e com origem', () => {
    const r = pronta([
      folha(),
      bruto(
        'S-1210',
        umS1210({
          id: umId(50),
          perApur: '2026-10',
          pagamentos: [
            { ideDmDev: 'A', vrLiq: '1500.00', dtPgto: '2026-10-05' },
            { ideDmDev: 'A', vrLiq: '1500.01' },
          ],
        }),
      ),
    ]);
    expect(r.auditoria.pessoas.get(CPF)?.pagamentos).toEqual([
      {
        data: '2026-10-05',
        periodoReferencia: '2026-09',
        demonstrativoId: 'A',
        tipoPagamento: '1',
        liquido: 1500_00,
        origem: {
          arquivo: 'lote.xml',
          posicaoNoLote: expect.any(Number),
          eventoId: umId(50),
          tipo: 'S-1210',
          caminho: 'ideBenef/infoPgto[1]',
        },
      },
      expect.objectContaining({
        liquido: 1500_01,
        origem: expect.objectContaining({ caminho: 'ideBenef/infoPgto[2]' }),
      }),
    ]);
  });

  it('S-1210 fora de N e N+1 vai para fora da auditoria', () => {
    const r = pronta([
      folha(),
      bruto(
        'S-1210',
        umS1210({ perApur: '2026-08', pagamentos: [{ ideDmDev: 'A', vrLiq: '1.00' }] }),
      ),
    ]);
    expect(r.auditoria.pessoas.get(CPF)?.pagamentos).toEqual([]);
    expect(r.foraDaAuditoria.map((f) => [f.motivo, f.detalhe])).toEqual([
      ['outra-competencia', '2026-08'],
    ]);
  });

  it('pagamento de quem não tem S-1200 no lote cria a pessoa (para a R011)', () => {
    const r = pronta([
      folha(),
      bruto(
        'S-1210',
        umS1210({ cpf: '12345678909', pagamentos: [{ ideDmDev: 'X', vrLiq: '1.00' }] }),
      ),
    ]);
    expect(r.auditoria.pessoas.get('12345678909')).toMatchObject({
      demonstrativos: [],
      pagamentos: [{ demonstrativoId: 'X' }],
    });
  });

  it('tpPgto 3 (S-2399) vai para fora da auditoria; os outros pagamentos do evento seguem', () => {
    const r = pronta([
      folha(),
      bruto(
        'S-1210',
        umS1210({
          pagamentos: [
            { ideDmDev: 'T', tpPgto: '3', vrLiq: '9.00' },
            { ideDmDev: 'A', vrLiq: '1.00' },
          ],
        }),
      ),
    ]);
    expect(r.auditoria.pessoas.get(CPF)?.pagamentos.map((p) => p.demonstrativoId)).toEqual(['A']);
    expect(r.foraDaAuditoria).toMatchObject([
      { motivo: 'evento-fora-do-mvp', detalhe: 'S-1210 infoPgto[1] tpPgto 3 (S-2399)' },
    ]);
  });

  it('retificação do S-1210: vale a última; todos ficam em eventos', () => {
    const r = pronta([
      folha(),
      bruto('S-1210', umS1210({ id: umId(61), pagamentos: [{ ideDmDev: 'A', vrLiq: '1.00' }] })),
      bruto(
        'S-1210',
        umS1210({
          id: umId(62),
          indRetif: '2',
          nrRecibo: '1.1.0000000000000000001',
          pagamentos: [{ ideDmDev: 'A', vrLiq: '2.00' }],
        }),
      ),
    ]);
    expect(r.auditoria.pessoas.get(CPF)?.pagamentos.map((p) => p.liquido)).toEqual([2_00]);
    expect(
      r.auditoria.eventos
        .filter((e) => e.origem.tipo === 'S-1210')
        .map((e) => [e.origem.eventoId, e.vigente, e.perApur]),
    ).toEqual([
      [umId(61), false, '2026-09'],
      [umId(62), true, '2026-09'],
    ]);
  });

  it('vrLiq fora do formato (só sem XSD) tira o evento', () => {
    const r = pronta([
      folha(),
      bruto('S-1210', umS1210({ pagamentos: [{ ideDmDev: 'A', vrLiq: '1,00' }] })),
    ]);
    expect(r.auditoria.pessoas.get(CPF)?.pagamentos).toEqual([]);
    expect(r.foraDaAuditoria).toMatchObject([
      { motivo: 'valor-invalido', detalhe: 'S-1210 vrLiq' },
    ]);
  });
});

describe('S-2299 no modelo', () => {
  const rescisao = (dtDeslig: string, extra = {}) =>
    bruto(
      'S-2299',
      umS2299({
        dtDeslig,
        dmDev: [
          {
            ideDmDev: 'RESC-1',
            itens: [{ codRubr: '1', vrRubr: '900.00' }],
            anteriores: [{ perRef: '2026-08', itens: [{ codRubr: '2', vrRubr: '50.00' }] }],
          },
        ],
        ...extra,
      }),
    );

  it('desligamento na competência: demonstrativo de rescisão com a matrícula do vínculo', () => {
    const r = pronta([
      bruto('S-1010', umS1010({ codRubr: '1' })),
      bruto('S-1010', umS1010({ codRubr: '2', tpRubr: '2' })),
      folha(),
      rescisao('2026-09-15'),
      bruto(
        'S-1210',
        umS1210({
          pagamentos: [{ ideDmDev: 'RESC-1', tpPgto: '2', perRef: '2026-09', vrLiq: '850.00' }],
        }),
      ),
    ]);
    const p = r.auditoria.pessoas.get(CPF);
    expect(p?.desligamentos).toMatchObject([{ matricula: '0001', data: '2026-09-15' }]);
    const resc = p?.demonstrativos.find((d) => d.fonte === 'rescisao');
    expect(resc).toMatchObject({ id: 'RESC-1', periodoReferencia: '2026-09' });
    expect(
      resc?.grupos.map((g) => [g.matricula, g.periodoAnterior, g.itens[0]?.origem.caminho]),
    ).toEqual([
      ['0001', undefined, 'infoDeslig/verbasResc/dmDev[1]/infoPerApur/grupo[1]/detVerbas[1]'],
      ['0001', '2026-08', 'infoDeslig/verbasResc/dmDev[1]/infoPerAnt/grupo[1]/detVerbas[1]'],
    ]);
    if (!resc) throw new Error('sem rescisão');
    expect(totais(resc, r.auditoria.rubricas, TABELAS_S_1_3).liquido).toBe(850_00);
    expect(p?.pagamentos).toMatchObject([
      { tipoPagamento: '2', demonstrativoId: 'RESC-1', liquido: 850_00 },
    ]);
  });

  it('desligamento de outro mês: o desligamento entra (R003), as verbas não', () => {
    const r = pronta([folha(), rescisao('2026-08-15')]);
    const p = r.auditoria.pessoas.get(CPF);
    expect(p?.desligamentos).toMatchObject([{ data: '2026-08-15' }]);
    expect(p?.demonstrativos.map((d) => d.fonte)).toEqual(['RGPS']);
    expect(r.foraDaAuditoria).toMatchObject([
      { motivo: 'outra-competencia', detalhe: 'verbas rescisórias de 2026-08' },
    ]);
  });

  it('S-2299 sem verbas rescisórias só registra o desligamento', () => {
    const r = pronta([folha(), bruto('S-2299', umS2299({ dtDeslig: '2026-09-30' }))]);
    expect(r.auditoria.pessoas.get(CPF)?.desligamentos).toHaveLength(1);
    expect(r.foraDaAuditoria).toEqual([]);
  });

  it('retificação do S-2299: vale a última do mesmo CPF e matrícula', () => {
    const r = pronta([
      folha(),
      bruto('S-2299', umS2299({ id: umId(71), dtDeslig: '2026-09-10' })),
      bruto(
        'S-2299',
        umS2299({
          id: umId(72),
          dtDeslig: '2026-09-20',
          indRetif: '2',
          nrRecibo: '1.1.0000000000000000002',
        }),
      ),
    ]);
    expect(r.auditoria.pessoas.get(CPF)?.desligamentos.map((d) => d.data)).toEqual(['2026-09-20']);
    expect(
      r.auditoria.eventos
        .filter((e) => e.origem.tipo === 'S-2299')
        .map((e) => [e.vigente, e.nrRecibo]),
    ).toEqual([
      [false, undefined],
      [true, '1.1.0000000000000000002'],
    ]);
  });

  it('valor de verba fora do formato (só sem XSD) tira o evento', () => {
    const ruim = bruto(
      'S-2299',
      umS2299({
        dtDeslig: '2026-09-15',
        dmDev: [{ ideDmDev: 'R', itens: [{ codRubr: '1', vrRubr: '9,00' }] }],
      }),
    );
    const r = pronta([folha(), ruim]);
    expect(r.auditoria.pessoas.get(CPF)?.desligamentos).toEqual([]);
    expect(r.foraDaAuditoria).toMatchObject([
      { motivo: 'valor-invalido', detalhe: 'S-2299 vrRubr' },
    ]);
  });
});
