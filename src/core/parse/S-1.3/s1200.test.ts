import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { umEvento } from '../../../../test/builders/xml';
import { lerLote } from '../../ingest/index';
import { ErroDeLeitura } from '../xml';
import { parseS1200 } from './s1200';

function eventoDaFixture(): string {
  const bytes = new Uint8Array(readFileSync('test/fixtures/s1200-lote-anonimizado.xml'));
  const r = lerLote([{ nome: 'lote.xml', bytes }]);
  if (r.recusa || !r.eventos[0]) throw new Error('fixture não lida');
  return r.eventos[0].xml;
}

describe('parseS1200', () => {
  it('lê a fixture anonimizada (estrutura do S-1200 real) como texto', () => {
    expect(parseS1200(eventoDaFixture())).toEqual({
      id: 'ID1112223330000002026102014334200001',
      ideEvento: { indRetif: '1', indApuracao: '1', perApur: '2026-09' },
      empregador: { tpInsc: '1', nrInsc: '11222333' },
      cpfTrab: '52998224725',
      dmDev: [
        {
          ideDmDev: 'FOLHA-2026-09-0001',
          codCateg: '302',
          perApur: [
            {
              tpInsc: '1',
              nrInsc: '11222333000181',
              codLotacao: 'LOT001',
              matricula: '0001',
              itens: [
                {
                  codRubr: '10',
                  ideTabRubr: '001',
                  fatorRubr: '27.50',
                  vrRubr: '500.00',
                  indApurIR: '0',
                },
                {
                  codRubr: '2',
                  ideTabRubr: '001',
                  fatorRubr: '14.00',
                  vrRubr: '700.00',
                  indApurIR: '0',
                },
                { codRubr: '61', ideTabRubr: '001', vrRubr: '6000.00', indApurIR: '0' },
              ],
            },
          ],
          perAnt: [],
        },
      ],
    });
  });

  it('lê infoPerAnt com o perRef de cada período, e vários dmDev', () => {
    const item = (cod: string, vr: string) =>
      `<itensRemun><codRubr>${cod}</codRubr><ideTabRubr>001</ideTabRubr><qtdRubr>2</qtdRubr><vrRubr>${vr}</vrRubr></itensRemun>`;
    const estab = (remun: string) =>
      `<ideEstabLot><tpInsc>1</tpInsc><nrInsc>11222333000181</nrInsc><codLotacao>L1</codLotacao>${remun}</ideEstabLot>`;
    const corpo =
      '<ideEvento><indRetif>2</indRetif><nrRecibo>1.1.0000000000000000001</nrRecibo><indApuracao>1</indApuracao><perApur>2026-09</perApur></ideEvento>' +
      '<ideEmpregador><tpInsc>1</tpInsc><nrInsc>11222333</nrInsc></ideEmpregador>' +
      '<ideTrabalhador><cpfTrab>52998224725</cpfTrab></ideTrabalhador>' +
      `<dmDev><ideDmDev>A</ideDmDev><codCateg>101</codCateg><infoPerApur>${estab(`<remunPerApur>${item('1', '10.00')}</remunPerApur>`)}</infoPerApur>` +
      '<infoPerAnt><ideADC><tpAcConv>A</tpAcConv><dsc>x</dsc><remunSuc>N</remunSuc>' +
      `<idePeriodo><perRef>2026-07</perRef>${estab(`<remunPerAnt><matricula>9</matricula>${item('5', '1.50')}${item('6', '2.00')}</remunPerAnt>`)}</idePeriodo>` +
      `<idePeriodo><perRef>2026-08</perRef>${estab(`<remunPerAnt>${item('5', '3.00')}</remunPerAnt>`)}</idePeriodo>` +
      '</ideADC></infoPerAnt></dmDev>' +
      '<dmDev><ideDmDev>B</ideDmDev><codCateg>101</codCateg></dmDev>';
    const dto = parseS1200(umEvento({ corpo }));
    expect(dto.ideEvento).toEqual({
      indRetif: '2',
      nrRecibo: '1.1.0000000000000000001',
      indApuracao: '1',
      perApur: '2026-09',
    });
    expect(dto.dmDev.map((d) => d.ideDmDev)).toEqual(['A', 'B']);
    expect(dto.dmDev[0]?.perAnt.map((g) => [g.perRef, g.matricula, g.itens.length])).toEqual([
      ['2026-07', '9', 2],
      ['2026-08', undefined, 1],
    ]);
    expect(dto.dmDev[0]?.perApur[0]?.itens[0]?.qtdRubr).toBe('2');
    expect(dto.dmDev[1]).toEqual({ ideDmDev: 'B', codCateg: '101', perApur: [], perAnt: [] });
  });

  it('campo obrigatório ausente vira ErroDeLeitura com o caminho', () => {
    const xml = eventoDaFixture().replace(/<cpfTrab>\d+<\/cpfTrab>/, '');
    expect(() => parseS1200(xml)).toThrow(ErroDeLeitura);
    expect(() => parseS1200(xml)).toThrow('ideTrabalhador/cpfTrab');
  });
});
