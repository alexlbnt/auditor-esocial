import { describe, expect, it } from 'vitest';
import { umaAuditoria, type ItemCurto } from '../../../../../test/builders/modelo';
import { TABELAS_S_1_3 } from '../../../leiaute/S-1.3/tabelas';
import type { Auditoria } from '../../../model/tipos';
import { executarRegras } from '../../engine';
import { R002 } from './rule';

const SEGREDO = new TextEncoder().encode('segredo-de-teste');
const CPF = '52998224725';
const rodar = (auditoria: Readonly<Auditoria>) =>
  executarRegras(
    [R002],
    {
      auditoria,
      tabelas: TABELAS_S_1_3,
      modeloDisponivel: true,
      xsd: { executado: true, reprovados: [] },
    },
    { segredo: SEGREDO },
  ).achados;

// Demonstrativo A: 3.150,00 de proventos − 330,00 de desconto = 2.820,00.
const comRubricas = () =>
  umaAuditoria()
    .comRubrica('1', 'provento')
    .comRubrica('2', 'provento')
    .comRubrica('50', 'desconto');
const itensA: ItemCurto[] = [
  ['1', 3000_00],
  ['2', 150_00],
  ['50', 330_00],
];

describe('R002', () => {
  it('dispara quando o pago difere do líquido, com esperado, encontrado e diferença em centavos', () => {
    const achados = rodar(
      comRubricas()
        .comPessoa(CPF, (p) => p.comDemonstrativo('A', [...itensA]).comPagamento('A', 2880_00))
        .construir(),
    );
    expect(achados).toMatchObject([
      {
        regra: 'R002',
        severidade: 'erro',
        cpf: CPF,
        matricula: '0001',
        evento: 'S-1210',
        campo: 'vrLiq',
        valores: {
          esperado: 2820_00,
          encontrado: 2880_00,
          diferenca: 60_00,
          proventos: 3150_00,
          descontos: 330_00,
          pagamentos: 1,
        },
      },
    ]);
  });

  it('não dispara quando bate no centavo', () => {
    expect(
      rodar(
        comRubricas()
          .comPessoa(CPF, (p) => p.comDemonstrativo('A', [...itensA]).comPagamento('A', 2820_00))
          .construir(),
      ),
    ).toEqual([]);
  });

  it('diferença de um centavo dispara', () => {
    const achados = rodar(
      comRubricas()
        .comPessoa(CPF, (p) => p.comDemonstrativo('A', [...itensA]).comPagamento('A', 2820_01))
        .construir(),
    );
    expect(achados[0]?.valores).toMatchObject({ diferenca: 1 });
  });

  it('soma todos os pagamentos do mesmo demonstrativo', () => {
    const a = comRubricas().comPessoa(CPF, (p) =>
      p
        .comDemonstrativo('A', [...itensA])
        .comPagamento('A', 1000_00)
        .comPagamento('A', 1820_00),
    );
    expect(rodar(a.construir())).toEqual([]);
  });

  it('liga por tpPgto + perRef + ideDmDev: pagamento de outra fonte ou competência não conta', () => {
    const a = comRubricas().comPessoa(
      CPF,
      (p) =>
        p
          .comDemonstrativo('A', [...itensA])
          .comPagamento('A', 2820_00, { tipoPagamento: '2' }) // aponta para rescisão "A"
          .comPagamento('A', 2820_00, { periodoReferencia: '2026-08' }), // outra competência
    );
    expect(rodar(a.construir())).toEqual([]); // sem pagamento ligado: é a R011, não a R002
  });

  it('demonstrativo de rescisão (D-17) se liga ao tpPgto 2', () => {
    const a = comRubricas().comPessoa(CPF, (p) =>
      p
        .comDemonstrativo('R', [['1', 900_00]], { fonte: 'rescisao' })
        .comPagamento('R', 850_00, { tipoPagamento: '2' }),
    );
    expect(rodar(a.construir())).toMatchObject([
      { valores: { esperado: 900_00, encontrado: 850_00 } },
    ]);
  });

  it('rubrica sem cadastro rebaixa para alerta e aponta a causa', () => {
    const a = comRubricas().comPessoa(CPF, (p) =>
      p.comDemonstrativo('A', [...itensA, ['77', 10_00]]).comPagamento('A', 2820_00),
    );
    expect(rodar(a.construir())).toMatchObject([
      {
        severidade: 'alerta',
        causa: 'rubrica:77|001',
        valores: { encontrado: 2820_00, rubricasSemCadastro: '77|001' },
      },
    ]);
  });

  it('lote sem nenhum S-1210: um Info só, não um achado por trabalhador', () => {
    const a = comRubricas()
      .comPessoa(CPF, (p) => p.comDemonstrativo('A', [...itensA]))
      .comPessoa('12345678909', (p) => p.comDemonstrativo('B', [['1', 1_00]]));
    expect(rodar(a.construir())).toMatchObject([
      { severidade: 'info', valores: { motivo: 'sem-S-1210', demonstrativos: 2 } },
    ]);
  });

  it('lote sem nenhum S-1010: um Info só', () => {
    const a = umaAuditoria().comPessoa(CPF, (p) =>
      p.comDemonstrativo('A', [...itensA]).comPagamento('A', 1_00),
    );
    expect(rodar(a.construir())).toMatchObject([
      { severidade: 'info', valores: { motivo: 'sem-S-1010', demonstrativos: 1 } },
    ]);
  });

  it('sem demonstrativo, sem achado', () => {
    expect(
      rodar(
        umaAuditoria()
          .comPessoa(CPF, (p) => p.comPagamento('X', 1_00))
          .construir(),
      ),
    ).toEqual([]);
  });

  it('dois demonstrativos do mesmo CPF têm chaves diferentes', () => {
    const a = comRubricas().comPessoa(CPF, (p) =>
      p
        .comDemonstrativo('A', [['1', 100_00]])
        .comPagamento('A', 1_00)
        .comDemonstrativo('B', [['1', 100_00]])
        .comPagamento('B', 2_00),
    );
    const chaves = rodar(a.construir()).map((x) => x.chave);
    expect(new Set(chaves).size).toBe(2);
  });
});
