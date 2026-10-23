// S-1200 (evtRemun) -> DTO, quase como está no XML. Campos e repetições conferidos no
// XSD oficial (evtRemun.xsd, pacotes 2026-07-01 e 2026-10-26).
import { criarLeitor, lista, no, noOpcional, texto, textoOpcional, type No } from '../xml.ts';
import {
  lerEmpregador,
  lerIdeEventoFolha,
  raizDoEvento,
  type DtoEmpregador,
  type DtoIdeEventoFolha,
} from './comum.ts';

export interface DtoItemRemun {
  codRubr: string;
  ideTabRubr: string;
  qtdRubr?: string;
  fatorRubr?: string;
  vrRubr: string;
  indApurIR?: string;
}

/** `ideEstabLot` + `remunPerApur`/`remunPerAnt`: um grupo por matrícula. */
export interface DtoGrupoRemun {
  tpInsc: string;
  nrInsc: string;
  codLotacao: string;
  matricula?: string;
  /** Só em `infoPerAnt`: competência a que a diferença se refere. */
  perRef?: string;
  itens: DtoItemRemun[];
}

export interface DtoDmDev {
  ideDmDev: string;
  codCateg: string;
  /** Itens de `infoPerApur` (a competência auditada). */
  perApur: DtoGrupoRemun[];
  /** Itens de `infoPerAnt` (diferenças de períodos anteriores). */
  perAnt: DtoGrupoRemun[];
}

export interface DtoS1200 {
  id: string;
  ideEvento: DtoIdeEventoFolha;
  empregador: DtoEmpregador;
  cpfTrab: string;
  dmDev: DtoDmDev[];
}

const ler = criarLeitor(
  new Set([
    'dmDev',
    'ideEstabLot',
    'remunPerApur',
    'remunPerAnt',
    'itensRemun',
    'ideADC',
    'idePeriodo',
  ]),
);

function lerItem(item: No): DtoItemRemun {
  const opcionais = {
    qtdRubr: textoOpcional(item, 'qtdRubr'),
    fatorRubr: textoOpcional(item, 'fatorRubr'),
    indApurIR: textoOpcional(item, 'indApurIR'),
  };
  return {
    codRubr: texto(item, 'codRubr', 'itensRemun/codRubr'),
    ideTabRubr: texto(item, 'ideTabRubr', 'itensRemun/ideTabRubr'),
    vrRubr: texto(item, 'vrRubr', 'itensRemun/vrRubr'),
    ...Object.fromEntries(Object.entries(opcionais).filter(([, v]) => v !== undefined)),
  };
}

function lerGrupos(estabs: No[], nomeRemun: string, perRef?: string): DtoGrupoRemun[] {
  return estabs.flatMap((estab) =>
    lista(estab, nomeRemun).map((remun) => {
      const matricula = textoOpcional(remun, 'matricula');
      return {
        tpInsc: texto(estab, 'tpInsc', 'ideEstabLot/tpInsc'),
        nrInsc: texto(estab, 'nrInsc', 'ideEstabLot/nrInsc'),
        codLotacao: texto(estab, 'codLotacao', 'ideEstabLot/codLotacao'),
        ...(matricula ? { matricula } : {}),
        ...(perRef ? { perRef } : {}),
        itens: lista(remun, 'itensRemun').map(lerItem),
      };
    }),
  );
}

export function parseS1200(xml: string): DtoS1200 {
  const evento = raizDoEvento(ler(xml), 'evtRemun');
  return {
    id: texto(evento, '@_Id', 'evtRemun/@Id'),
    ideEvento: lerIdeEventoFolha(evento),
    empregador: lerEmpregador(evento),
    cpfTrab: texto(no(evento, 'ideTrabalhador'), 'cpfTrab', 'ideTrabalhador/cpfTrab'),
    dmDev: lista(evento, 'dmDev').map((dm) => {
      const perApur = noOpcional(dm, 'infoPerApur');
      const perAnt = noOpcional(dm, 'infoPerAnt');
      return {
        ideDmDev: texto(dm, 'ideDmDev', 'dmDev/ideDmDev'),
        codCateg: texto(dm, 'codCateg', 'dmDev/codCateg'),
        perApur: perApur ? lerGrupos(lista(perApur, 'ideEstabLot'), 'remunPerApur') : [],
        perAnt: perAnt
          ? lista(perAnt, 'ideADC').flatMap((adc) =>
              lista(adc, 'idePeriodo').flatMap((periodo) =>
                lerGrupos(
                  lista(periodo, 'ideEstabLot'),
                  'remunPerAnt',
                  texto(periodo, 'perRef', 'idePeriodo/perRef'),
                ),
              ),
            )
          : [],
      };
    }),
  };
}
