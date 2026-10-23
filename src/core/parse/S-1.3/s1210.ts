// S-1210 (evtPgtos) -> DTO. Campos conferidos no XSD oficial (evtPgtos.xsd): o ideEvento
// não tem indApuracao e o perApur é sempre AAAA-MM (T_ideEvento_folha_mensal).
import { criarLeitor, lista, no, texto, textoOpcional } from '../xml.ts';
import { lerEmpregador, raizDoEvento, type DtoEmpregador } from './comum.ts';

export interface DtoInfoPgto {
  dtPgto: string;
  /** 1 = S-1200, 2 = S-2299, 3 = S-2399, 4 = S-1202, 5 = S-1207 */
  tpPgto: string;
  perRef: string;
  ideDmDev: string;
  vrLiq: string;
}

export interface DtoS1210 {
  id: string;
  ideEvento: { indRetif: string; nrRecibo?: string; perApur: string };
  empregador: DtoEmpregador;
  cpfBenef: string;
  infoPgto: DtoInfoPgto[];
}

const ler = criarLeitor(new Set(['infoPgto']));

export function parseS1210(xml: string): DtoS1210 {
  const evento = raizDoEvento(ler(xml), 'evtPgtos');
  const ide = no(evento, 'ideEvento');
  const nrRecibo = textoOpcional(ide, 'nrRecibo');
  const benef = no(evento, 'ideBenef');
  return {
    id: texto(evento, '@_Id', 'evtPgtos/@Id'),
    ideEvento: {
      indRetif: texto(ide, 'indRetif', 'ideEvento/indRetif'),
      ...(nrRecibo ? { nrRecibo } : {}),
      perApur: texto(ide, 'perApur', 'ideEvento/perApur'),
    },
    empregador: lerEmpregador(evento),
    cpfBenef: texto(benef, 'cpfBenef', 'ideBenef/cpfBenef'),
    infoPgto: lista(benef, 'infoPgto').map((p) => {
      const campo = (nome: string) => texto(p, nome, `infoPgto/${nome}`);
      return {
        dtPgto: campo('dtPgto'),
        tpPgto: campo('tpPgto'),
        perRef: campo('perRef'),
        ideDmDev: campo('ideDmDev'),
        vrLiq: campo('vrLiq'),
      };
    }),
  };
}
