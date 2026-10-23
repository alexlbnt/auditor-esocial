// S-2299 (evtDeslig) -> DTO. Campos conferidos no XSD oficial (evtDeslig.xsd): matrícula
// em ideVinculo; demonstrativos de rescisão em infoDeslig/verbasResc/dmDev (D-17).
import { criarLeitor, lista, no, noOpcional, texto, textoOpcional, type No } from '../xml.ts';
import { lerEmpregador, raizDoEvento, type DtoEmpregador } from './comum.ts';
import { lerItem, type DtoGrupoRemun } from './s1200.ts';

export interface DtoDmDevRescisao {
  ideDmDev: string;
  /** Grupos sem matrícula própria: a do vínculo vale para todos. */
  perApur: DtoGrupoRemun[];
  perAnt: DtoGrupoRemun[];
}

export interface DtoS2299 {
  id: string;
  ideEvento: { indRetif: string; nrRecibo?: string };
  empregador: DtoEmpregador;
  cpfTrab: string;
  matricula: string;
  dtDeslig: string;
  dmDev: DtoDmDevRescisao[];
}

const ler = criarLeitor(new Set(['dmDev', 'ideEstabLot', 'detVerbas', 'ideADC', 'idePeriodo']));

function lerGrupos(estabs: No[], perRef?: string): DtoGrupoRemun[] {
  return estabs.map((estab) => ({
    tpInsc: texto(estab, 'tpInsc', 'ideEstabLot/tpInsc'),
    nrInsc: texto(estab, 'nrInsc', 'ideEstabLot/nrInsc'),
    codLotacao: texto(estab, 'codLotacao', 'ideEstabLot/codLotacao'),
    ...(perRef ? { perRef } : {}),
    itens: lista(estab, 'detVerbas').map((i) => lerItem(i, 'detVerbas')),
  }));
}

export function parseS2299(xml: string): DtoS2299 {
  const evento = raizDoEvento(ler(xml), 'evtDeslig');
  const ide = no(evento, 'ideEvento');
  const nrRecibo = textoOpcional(ide, 'nrRecibo');
  const vinculo = no(evento, 'ideVinculo');
  const deslig = no(evento, 'infoDeslig');
  const verbas = noOpcional(deslig, 'verbasResc');
  return {
    id: texto(evento, '@_Id', 'evtDeslig/@Id'),
    ideEvento: {
      indRetif: texto(ide, 'indRetif', 'ideEvento/indRetif'),
      ...(nrRecibo ? { nrRecibo } : {}),
    },
    empregador: lerEmpregador(evento),
    cpfTrab: texto(vinculo, 'cpfTrab', 'ideVinculo/cpfTrab'),
    matricula: texto(vinculo, 'matricula', 'ideVinculo/matricula'),
    dtDeslig: texto(deslig, 'dtDeslig', 'infoDeslig/dtDeslig'),
    dmDev: (verbas ? lista(verbas, 'dmDev') : []).map((dm) => {
      const perApur = noOpcional(dm, 'infoPerApur');
      const perAnt = noOpcional(dm, 'infoPerAnt');
      return {
        ideDmDev: texto(dm, 'ideDmDev', 'verbasResc/dmDev/ideDmDev'),
        perApur: perApur ? lerGrupos(lista(perApur, 'ideEstabLot')) : [],
        perAnt: perAnt
          ? lista(perAnt, 'ideADC').flatMap((adc) =>
              lista(adc, 'idePeriodo').flatMap((periodo) =>
                lerGrupos(
                  lista(periodo, 'ideEstabLot'),
                  texto(periodo, 'perRef', 'idePeriodo/perRef'),
                ),
              ),
            )
          : [],
      };
    }),
  };
}
