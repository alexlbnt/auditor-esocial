// Os geradores fictícios só valem se o XSD oficial aceita o que eles produzem.
import { describe, expect, it } from 'vitest';
import { carregarPacote, listarPacotes } from '../../scripts/lib/pacotes-xsd';
import { criarValidadorLibxml2 } from '../../src/core/xsd/libxml2';
import { umS1010, umS1200 } from './esocial';

const ns = (evento: string) => `http://www.esocial.gov.br/schema/evt/${evento}/v_S_01_03_00`;

describe.each(listarPacotes())('geradores contra o pacote oficial %s', (data) => {
  const casos: [string, string, string][] = [
    [
      'S-1200 simples',
      'evtRemun',
      umS1200({
        dmDev: [
          {
            ideDmDev: 'A',
            grupos: [{ matricula: '1', itens: [{ codRubr: '1', vrRubr: '100.00' }] }],
          },
        ],
      }),
    ],
    [
      'S-1200 retificação com período anterior',
      'evtRemun',
      umS1200({
        indRetif: '2',
        nrRecibo: '1.1.0000000000000000001',
        dmDev: [
          {
            ideDmDev: 'A',
            grupos: [{ matricula: '1', itens: [{ codRubr: '1', vrRubr: '100.00' }] }],
            anteriores: [
              {
                perRef: '2026-08',
                grupos: [{ matricula: '1', itens: [{ codRubr: '2', vrRubr: '5.00' }] }],
              },
            ],
          },
        ],
      }),
    ],
    [
      'S-1200 13º',
      'evtRemun',
      umS1200({
        indApuracao: '2',
        perApur: '2026',
        dmDev: [{ ideDmDev: 'D', grupos: [{ itens: [{ codRubr: '1', vrRubr: '1.00' }] }] }],
      }),
    ],
    ['S-1010 inclusão', 'evtTabRubrica', umS1010({ codRubr: '1' })],
    [
      'S-1010 desconto',
      'evtTabRubrica',
      umS1010({
        codRubr: '2',
        tpRubr: '2',
        natRubr: '9201',
        codIncCP: '31',
        codIncIRRF: '31',
        codIncFGTS: '00',
      }),
    ],
    [
      'S-1010 alteração com nova validade',
      'evtTabRubrica',
      umS1010({ codRubr: '1', operacao: 'alteracao', novaValidade: { iniValid: '2026-06' } }),
    ],
    [
      'S-1010 exclusão',
      'evtTabRubrica',
      umS1010({ codRubr: '1', operacao: 'exclusao', fimValid: '2026-12' }),
    ],
  ];

  it.each(casos)('%s passa no XSD', (_nome, evento, xml) => {
    const v = criarValidadorLibxml2(carregarPacote(data));
    try {
      const r = v.validar(xml, ns(evento));
      expect(r.status === 'invalido' ? r.erros.map((e) => e.mensagem) : r.status).toBe('valido');
    } finally {
      v.dispose();
    }
  });
});
