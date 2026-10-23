// S-1010 (evtTabRubrica) -> DTO. Campos conferidos no XSD oficial (evtTabRubrica.xsd).
import { criarLeitor, no, noOpcional, texto, textoOpcional, type No } from '../xml.ts';
import { lerEmpregador, raizDoEvento, type DtoEmpregador } from './comum.ts';

export interface DtoIdeRubrica {
  codRubr: string;
  ideTabRubr: string;
  iniValid: string;
  fimValid?: string;
}

export interface DtoDadosRubrica {
  dscRubr: string;
  natRubr: string;
  tpRubr: string;
  codIncCP: string;
  codIncIRRF: string;
  codIncFGTS: string;
  codIncCPRP?: string;
}

export type DtoOperacaoRubrica =
  | { operacao: 'inclusao'; ideRubrica: DtoIdeRubrica; dadosRubrica: DtoDadosRubrica }
  | {
      operacao: 'alteracao';
      ideRubrica: DtoIdeRubrica;
      dadosRubrica: DtoDadosRubrica;
      novaValidade?: { iniValid: string; fimValid?: string };
    }
  | { operacao: 'exclusao'; ideRubrica: DtoIdeRubrica };

export interface DtoS1010 {
  id: string;
  empregador: DtoEmpregador;
  rubrica: DtoOperacaoRubrica;
}

const ler = criarLeitor(new Set());

function lerValidade(pai: No, caminho: string): { iniValid: string; fimValid?: string } {
  const fimValid = textoOpcional(pai, 'fimValid');
  return {
    iniValid: texto(pai, 'iniValid', `${caminho}/iniValid`),
    ...(fimValid ? { fimValid } : {}),
  };
}

function lerIde(operacao: No): DtoIdeRubrica {
  const ide = no(operacao, 'ideRubrica');
  return {
    codRubr: texto(ide, 'codRubr', 'ideRubrica/codRubr'),
    ideTabRubr: texto(ide, 'ideTabRubr', 'ideRubrica/ideTabRubr'),
    ...lerValidade(ide, 'ideRubrica'),
  };
}

function lerDados(operacao: No): DtoDadosRubrica {
  const d = no(operacao, 'dadosRubrica');
  const codIncCPRP = textoOpcional(d, 'codIncCPRP');
  const campo = (nome: string) => texto(d, nome, `dadosRubrica/${nome}`);
  return {
    dscRubr: campo('dscRubr'),
    natRubr: campo('natRubr'),
    tpRubr: campo('tpRubr'),
    codIncCP: campo('codIncCP'),
    codIncIRRF: campo('codIncIRRF'),
    codIncFGTS: campo('codIncFGTS'),
    ...(codIncCPRP ? { codIncCPRP } : {}),
  };
}

function lerOperacao(info: No): DtoOperacaoRubrica {
  const inclusao = noOpcional(info, 'inclusao');
  if (inclusao)
    return { operacao: 'inclusao', ideRubrica: lerIde(inclusao), dadosRubrica: lerDados(inclusao) };
  const alteracao = noOpcional(info, 'alteracao');
  if (alteracao) {
    const nova = noOpcional(alteracao, 'novaValidade');
    return {
      operacao: 'alteracao',
      ideRubrica: lerIde(alteracao),
      dadosRubrica: lerDados(alteracao),
      ...(nova ? { novaValidade: lerValidade(nova, 'novaValidade') } : {}),
    };
  }
  return { operacao: 'exclusao', ideRubrica: lerIde(no(info, 'exclusao', 'infoRubrica/exclusao')) };
}

export function parseS1010(xml: string): DtoS1010 {
  const evento = raizDoEvento(ler(xml), 'evtTabRubrica');
  return {
    id: texto(evento, '@_Id', 'evtTabRubrica/@Id'),
    empregador: lerEmpregador(evento),
    rubrica: lerOperacao(no(evento, 'infoRubrica')),
  };
}
