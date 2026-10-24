import { describe, expect, it } from 'vitest';
import type { AchadoParaEnvio } from '../../src/core/findings/envio';
import { R002 } from '../../src/core/rules/catalog/R002-liquido-pagamento/rule';
import { csvDeAchados, csvForaDaAuditoria, formatarCentavos } from './csv';

const achado: AchadoParaEnvio = {
  regra: 'R002',
  regraVersao: 1,
  severidade: 'erro',
  chave: 'abcDEF',
  cpfMascarado: '***.982.247-**',
  matricula: '0001',
  evento: 'S-1210',
  eventoId: 'ID**',
  arquivo: 'lote.zip/a.xml',
  campo: 'vrLiq',
  valores: {
    esperado: 282000,
    encontrado: 288000,
    diferenca: 6000,
    proventos: 315000,
    pagamentos: '1',
  },
};
const linhas = (csv: string) =>
  csv
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter(Boolean);

describe('formatarCentavos', () => {
  it.each([
    [0, '0,00'],
    [5, '0,05'],
    [282000, '2820,00'],
    [-6000, '-60,00'],
    [-1, '-0,01'],
    [123456789, '1234567,89'],
  ])('%i -> %s', (centavos, texto) => {
    expect(formatarCentavos(centavos)).toBe(texto);
  });
});

describe('csvDeAchados', () => {
  const csv = csvDeAchados([achado], [R002], '2026-09');

  it('abre com BOM, separa por ; e termina linha com CRLF', () => {
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(linhas(csv)[0]).toBe(
      'severidade;regra;versao;titulo;cpf;matricula;competencia;evento;arquivo;campo;esperado;encontrado;diferenca;causa;detalhes;chave',
    );
  });

  it('dinheiro com vírgula decimal; o resto vai para detalhes', () => {
    expect(linhas(csv)[1]).toBe(
      'erro;R002;1;Líquido pago diferente do demonstrativo;***.982.247-**;0001;2026-09;S-1210;lote.zip/a.xml;vrLiq;2820,00;2880,00;60,00;;proventos=3150,00 | pagamentos=1;abcDEF',
    );
  });

  it('protege contra fórmula e escapa ; e aspas', () => {
    const perigoso = { ...achado, causa: '=HYPERLINK("x")', campo: 'a;b' };
    const [, dados] = linhas(csvDeAchados([perigoso], [R002], '2026-09'));
    expect(dados).toContain(`"'=HYPERLINK(""x"")"`);
    expect(dados).toContain('"a;b"');
  });

  it('diferença negativa continua número', () => {
    const negativo = { ...achado, valores: { ...achado.valores, diferenca: -6000 } };
    expect(linhas(csvDeAchados([negativo], [R002], '2026-09'))[1]).toContain(';-60,00;');
  });

  it('sem achados, só o cabeçalho', () => {
    expect(linhas(csvDeAchados([], [R002], '2026-09'))).toHaveLength(1);
  });
});

describe('csvForaDaAuditoria', () => {
  it('lista entrada e regras não executadas, sem 11 dígitos', () => {
    const csv = csvForaDaAuditoria(
      [
        { arquivo: 'S1200_52998224725.xml', motivo: 'nao-xml' },
        {
          arquivo: 'lote.xml',
          posicaoNoLote: 3,
          motivo: 'evento-fora-do-mvp',
          detalhe: 'evtBasesTrab',
        },
      ],
      [{ codigo: 'R009', versao: 1, motivo: 'falhou', erro: 'TypeError' }],
    );
    expect(linhas(csv)).toEqual([
      'tipo;arquivo;posicao;motivo;detalhe',
      'entrada;S1200_***982247**.xml;;nao-xml;',
      'entrada;lote.xml;3;evento-fora-do-mvp;evtBasesTrab',
      'regra;;;R009@1 não executada: falhou;TypeError',
    ]);
    expect(csv).not.toMatch(/\d{11}/);
  });
});
