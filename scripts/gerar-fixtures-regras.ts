// Gera fixtures/dispara.xml e limpo.xml das regras a partir dos geradores fictícios
// (validados no XSD oficial). Rodar: node scripts/gerar-fixtures-regras.ts
import { writeFileSync } from 'node:fs';

const { umS1010, umS1200, umS1210, umS2299 } = await import('../test/builders/esocial.ts');
const { umLote, umId } = await import('../test/builders/xml.ts');
const C = 'src/core/rules/catalog/';
const xml = (eventos: string[]) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' + umLote(eventos) + '\n';
const grava = (pasta: string, nome: string, eventos: string[]) =>
  writeFileSync(`${C}${pasta}/fixtures/${nome}.xml`, xml(eventos));

// R002: 3.000,00 + 150,00 − 330,00 = 2.820,00
const rubricas = [
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
];
const folhaA = umS1200({
  id: umId(1),
  dmDev: [
    {
      ideDmDev: 'FOLHA-A',
      grupos: [
        {
          matricula: '0001',
          itens: [
            { codRubr: '1', vrRubr: '3000.00' },
            { codRubr: '2', vrRubr: '150.00' },
            { codRubr: '50', vrRubr: '330.00' },
          ],
        },
      ],
    },
  ],
});
const pgto = (vrLiq: string) =>
  umS1210({
    id: umId(2),
    perApur: '2026-10',
    pagamentos: [{ ideDmDev: 'FOLHA-A', vrLiq, dtPgto: '2026-10-05' }],
  });
grava('R002-liquido-pagamento', 'dispara', [...rubricas, folhaA, pgto('2880.00')]);
grava('R002-liquido-pagamento', 'limpo', [...rubricas, folhaA, pgto('2820.00')]);

// R003: S-1200 de 09/2026 para a matrícula 0001
const folha = umS1200({
  id: umId(11),
  dmDev: [
    {
      ideDmDev: 'FOLHA-B',
      grupos: [{ matricula: '0001', itens: [{ codRubr: '1', vrRubr: '3000.00' }] }],
    },
  ],
});
grava('R003-remuneracao-apos-desligamento', 'dispara', [
  folha,
  umS2299({ id: umId(12), matricula: '0001', dtDeslig: '2026-08-15' }),
]);
grava('R003-remuneracao-apos-desligamento', 'limpo', [
  folha,
  umS2299({ id: umId(12), matricula: '0001', dtDeslig: '2026-09-15' }),
]);

// R009 (com a tabela fictícia de fixtures/contexto.ts): natureza 1000 espera codIncCP 11
const uso = umS1200({
  id: umId(21),
  dmDev: [
    {
      ideDmDev: 'FOLHA-C',
      grupos: [{ matricula: '0001', itens: [{ codRubr: '1', vrRubr: '100.00' }] }],
    },
  ],
});
grava('R009-incidencia-natureza', 'dispara', [
  umS1010({ id: umId(921), codRubr: '1', natRubr: '1000', codIncCP: '00' }),
  uso,
]);
grava('R009-incidencia-natureza', 'limpo', [
  umS1010({ id: umId(921), codRubr: '1', natRubr: '1000', codIncCP: '11' }),
  uso,
]);
