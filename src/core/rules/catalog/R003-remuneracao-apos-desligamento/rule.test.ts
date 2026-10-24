import { describe, expect, it } from 'vitest';
import { umaAuditoria, umDemonstrativo } from '../../../../../test/builders/modelo';
import { TABELAS_S_1_3 } from '../../../leiaute/S-1.3/tabelas';
import type { Auditoria } from '../../../model/tipos';
import { executarRegras } from '../../engine';
import { R003 } from './rule';

const SEGREDO = new TextEncoder().encode('segredo-de-teste');
const CPF = '52998224725';
const rodar = (auditoria: Readonly<Auditoria>) =>
  executarRegras(
    [R003],
    {
      auditoria,
      tabelas: TABELAS_S_1_3,
      modeloDisponivel: true,
      xsd: { executado: true, reprovados: [] },
    },
    { segredo: SEGREDO },
  ).achados;
const folha = () => [['1', 3000_00]] as [string, number][];

describe('R003', () => {
  it('dispara: desligado antes da competência e com infoPerApur da mesma matrícula', () => {
    const a = umaAuditoria().comPessoa(CPF, (p) =>
      p.comDemonstrativo('A', folha()).comDesligamento('0001', '2026-08-15'),
    );
    expect(rodar(a.construir())).toMatchObject([
      {
        regra: 'R003',
        severidade: 'erro',
        cpf: CPF,
        matricula: '0001',
        evento: 'S-1200',
        campo: 'infoPerApur',
        valores: { dataDesligamento: '2026-08-15', competencia: '2026-09' },
      },
    ]);
  });

  it('dispara no limite: desligado no último dia do mês anterior', () => {
    const a = umaAuditoria().comPessoa(CPF, (p) =>
      p.comDemonstrativo('A', folha()).comDesligamento('0001', '2026-08-31'),
    );
    expect(rodar(a.construir())).toHaveLength(1);
  });

  it('não dispara com desligamento dentro da competência (inclusive no dia 1º)', () => {
    for (const data of ['2026-09-01', '2026-09-30']) {
      const a = umaAuditoria().comPessoa(CPF, (p) =>
        p.comDemonstrativo('A', folha()).comDesligamento('0001', data),
      );
      expect(rodar(a.construir()), data).toEqual([]);
    }
  });

  it('não dispara para outra matrícula do mesmo CPF (outro vínculo)', () => {
    const a = umaAuditoria().comPessoa(CPF, (p) =>
      p.comDemonstrativo('A', folha(), { matricula: '0002' }).comDesligamento('0001', '2026-08-15'),
    );
    expect(rodar(a.construir())).toEqual([]);
  });

  it('não dispara quando só há diferença de período anterior (retroativo)', () => {
    const dm = umDemonstrativo('A', folha());
    const retroativo = {
      ...dm,
      grupos: dm.grupos.map((g) => ({ ...g, periodoAnterior: '2026-07' })),
    };
    const a = umaAuditoria().comPessoa(CPF, (p) => {
      p.pessoa.demonstrativos.push(retroativo);
      return p.comDesligamento('0001', '2026-08-15');
    });
    expect(rodar(a.construir())).toEqual([]);
  });

  it('não olha demonstrativo de rescisão', () => {
    const a = umaAuditoria().comPessoa(CPF, (p) =>
      p.comDemonstrativo('R', folha(), { fonte: 'rescisao' }).comDesligamento('0001', '2026-08-15'),
    );
    expect(rodar(a.construir())).toEqual([]);
  });

  it('13º (competência AAAA): desligado no ano anterior dispara; no próprio ano, não', () => {
    const com = (data: string) =>
      rodar(
        umaAuditoria()
          .naCompetencia('2026')
          .comPessoa(CPF, (p) =>
            p.comDemonstrativo('D', folha(), { competencia: '2026' }).comDesligamento('0001', data),
          )
          .construir(),
      );
    expect(com('2025-12-20')).toHaveLength(1);
    expect(com('2026-05-10')).toEqual([]);
  });
});
