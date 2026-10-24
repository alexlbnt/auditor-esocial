// Lote golden (nível 4): um lote fictício com um erro plantado por regra gera um JSON
// de achados versionado em test/golden/achados.json. Mudou o comportamento? O diff
// aparece no PR. Para aceitar a mudança: npx vitest run test/golden.test.ts -u
import { afterAll, describe, expect, it } from 'vitest';
import { carregarPacote } from '../scripts/lib/pacotes-xsd';
import { auditar } from '../src/core/audit';
import { paraEnvio } from '../src/core/findings/envio';
import { TABELAS_FICTICIAS } from '../src/core/rules/catalog/R009-incidencia-natureza/fixtures/contexto';
import { criarValidadorLibxml2 } from '../src/core/xsd/libxml2';
import { umS1010, umS1200, umS1210, umS2299 } from './builders/esocial';
import { umId, umLote } from './builders/xml';

const A = '52998224725'; // R002: pago 2.880,00, demonstrativo fecha em 2.820,00
const B = '12345678909'; // R003: desligado em 15/08 com folha de 09
const C = '11144477735'; // limpo
const PACOTE = '2026-10-26';
const SEGREDO = new TextEncoder().encode('segredo-do-lote-golden');

const xml = (eventos: string[]) => new TextEncoder().encode(umLote(eventos));
const item = (codRubr: string, vrRubr: string) => ({ codRubr, vrRubr });

const LOTE = [
  {
    nome: 'golden/01-rubricas.xml',
    bytes: xml([
      umS1010({ id: umId(901), codRubr: '1', tpRubr: '1' }),
      umS1010({ id: umId(902), codRubr: '2', tpRubr: '1' }),
      umS1010({
        id: umId(903),
        codRubr: '50',
        tpRubr: '2',
        natRubr: '9201',
        codIncCP: '31',
        codIncIRRF: '31',
        codIncFGTS: '00',
      }),
      // R009 (tabela fictícia: natureza 1000 espera codIncCP 11)
      umS1010({ id: umId(904), codRubr: '7', tpRubr: '1', natRubr: '1000', codIncCP: '00' }),
    ]),
  },
  {
    nome: 'golden/02-trabalhador-a.xml',
    bytes: xml([
      umS1200({
        id: umId(1),
        cpf: A,
        dmDev: [
          {
            ideDmDev: 'FOLHA-A',
            grupos: [
              {
                matricula: '0001',
                itens: [item('1', '3000.00'), item('2', '150.00'), item('50', '330.00')],
              },
            ],
          },
        ],
      }),
      umS1210({
        id: umId(2),
        cpf: A,
        perApur: '2026-10',
        pagamentos: [{ ideDmDev: 'FOLHA-A', vrLiq: '2880.00', dtPgto: '2026-10-05' }],
      }),
    ]),
  },
  {
    nome: 'golden/03-trabalhador-b.xml',
    bytes: xml([
      umS1200({
        id: umId(3),
        cpf: B,
        dmDev: [
          { ideDmDev: 'FOLHA-B', grupos: [{ matricula: '0002', itens: [item('1', '3000.00')] }] },
        ],
      }),
      umS1210({
        id: umId(4),
        cpf: B,
        perApur: '2026-10',
        pagamentos: [{ ideDmDev: 'FOLHA-B', vrLiq: '3000.00', dtPgto: '2026-10-05' }],
      }),
      umS2299({ id: umId(5), cpf: B, matricula: '0002', dtDeslig: '2026-08-15' }),
    ]),
  },
  {
    nome: 'golden/04-trabalhador-c.xml',
    bytes: xml([
      umS1200({
        id: umId(6),
        cpf: C,
        dmDev: [
          {
            ideDmDev: 'FOLHA-C',
            grupos: [{ matricula: '0003', itens: [item('1', '3000.00'), item('7', '100.00')] }],
          },
        ],
      }),
      umS1210({
        id: umId(7),
        cpf: C,
        perApur: '2026-09',
        pagamentos: [{ ideDmDev: 'FOLHA-C', vrLiq: '3100.00', dtPgto: '2026-09-30' }],
      }),
    ]),
  },
  {
    // R001: CPF com 10 dígitos
    nome: 'golden/05-reprovado.xml',
    bytes: xml([
      umS1200({
        id: umId(8),
        cpf: '5299822472',
        dmDev: [{ ideDmDev: 'X', grupos: [{ itens: [item('1', '1.00')] }] }],
      }),
    ]),
  },
];

const validador = criarValidadorLibxml2(carregarPacote(PACOTE));
afterAll(() => validador.dispose());

function rodar(entradas: typeof LOTE) {
  const r = auditar(entradas, { validador, segredo: SEGREDO, tabelas: TABELAS_FICTICIAS });
  if (r.recusa || !r.motor) throw new Error('lote golden não auditado');
  return {
    pacoteXsd: r.pacoteXsd,
    modelo:
      r.modelo.tipo === 'pronta'
        ? {
            competencia: r.modelo.auditoria.competencia,
            trabalhadores: r.modelo.auditoria.pessoas.size,
          }
        : r.modelo.tipo,
    regrasExecutadas: r.motor.regrasExecutadas,
    naoExecutadas: r.motor.naoExecutadas,
    foraDaAuditoria: r.foraDaAuditoria,
    achados: r.motor.achados.map(paraEnvio),
  };
}

describe('lote golden', () => {
  const resultado = rodar(LOTE);

  it('bate com test/golden/achados.json', async () => {
    await expect(`${JSON.stringify(resultado, null, 2)}\n`).toMatchFileSnapshot(
      'golden/achados.json',
    );
  });

  it('cada regra do catálogo tem o seu erro plantado', () => {
    const regras = new Set(resultado.achados.map((a) => a.regra));
    expect([...regras].sort()).toEqual(['R001', 'R002', 'R003', 'R009']);
  });

  it('é determinístico: mesma entrada em outra ordem, mesmo resultado (RNF-17)', () => {
    expect(rodar([...LOTE].reverse())).toEqual(resultado);
  });

  it('nada do resultado tem 11 dígitos seguidos', () => {
    expect(JSON.stringify(resultado)).not.toMatch(/\d{11}/);
  });
});
