import { no, texto, textoOpcional, type No } from '../xml.ts';

/** `ideEmpregador`, igual em todos os eventos (XSD: T_ideEmpregador). */
export interface DtoEmpregador {
  tpInsc: string;
  nrInsc: string;
}

/** `ideEvento` dos periódicos (XSD: T_ideEvento_folha). */
export interface DtoIdeEventoFolha {
  indRetif: string;
  nrRecibo?: string;
  indApuracao: string;
  perApur: string;
}

export function lerEmpregador(evento: No): DtoEmpregador {
  const ide = no(evento, 'ideEmpregador');
  return {
    tpInsc: texto(ide, 'tpInsc', 'ideEmpregador/tpInsc'),
    nrInsc: texto(ide, 'nrInsc', 'ideEmpregador/nrInsc'),
  };
}

export function lerIdeEventoFolha(evento: No): DtoIdeEventoFolha {
  const ide = no(evento, 'ideEvento');
  const nrRecibo = textoOpcional(ide, 'nrRecibo');
  return {
    indRetif: texto(ide, 'indRetif', 'ideEvento/indRetif'),
    ...(nrRecibo ? { nrRecibo } : {}),
    indApuracao: texto(ide, 'indApuracao', 'ideEvento/indApuracao'),
    perApur: texto(ide, 'perApur', 'ideEvento/perApur'),
  };
}

/** Elemento do evento (`evtRemun`, `evtTabRubrica`...) dentro do `eSocial`. */
export function raizDoEvento(documento: No, nome: string): No {
  return no(no(documento, 'eSocial'), nome, `eSocial/${nome}`);
}
