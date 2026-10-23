// Geradores de eventos fictícios que passam no XSD oficial (test/builders/esocial.test.ts
// garante isso). Estrutura tirada de test/fixtures/s1200-lote-anonimizado.xml e do XSD.
import { umId } from './xml.ts';

const NS = (evento: string) => `http://www.esocial.gov.br/schema/evt/${evento}/v_S_01_03_00`;
const EMPREGADOR = '<ideEmpregador><tpInsc>1</tpInsc><nrInsc>11222333</nrInsc></ideEmpregador>';
const ESTAB = '<tpInsc>1</tpInsc><nrInsc>11222333000181</nrInsc>';
const PROC = '<tpAmb>2</tpAmb><procEmi>1</procEmi><verProc>TESTE 1.0</verProc>';

const opcional = (tag: string, valor?: string) =>
  valor === undefined ? '' : `<${tag}>${valor}</${tag}>`;

export interface ItemFicticio {
  codRubr: string;
  ideTabRubr?: string;
  vrRubr: string;
}

export interface GrupoFicticio {
  matricula?: string;
  codLotacao?: string;
  itens: ItemFicticio[];
}

export interface DmDevFicticio {
  ideDmDev: string;
  codCateg?: string;
  grupos: GrupoFicticio[];
  /** Diferenças de períodos anteriores, por perRef. */
  anteriores?: { perRef: string; grupos: GrupoFicticio[] }[];
}

export interface S1200Ficticio {
  id?: string;
  cpf?: string;
  perApur?: string;
  indApuracao?: '1' | '2';
  indRetif?: '1' | '2';
  nrRecibo?: string;
  dmDev: DmDevFicticio[];
}

const itens = (lista: ItemFicticio[]) =>
  lista
    .map(
      (i) =>
        `<itensRemun><codRubr>${i.codRubr}</codRubr><ideTabRubr>${i.ideTabRubr ?? '001'}</ideTabRubr>` +
        `<vrRubr>${i.vrRubr}</vrRubr><indApurIR>0</indApurIR></itensRemun>`,
    )
    .join('');

const grupos = (lista: GrupoFicticio[], remun: 'remunPerApur' | 'remunPerAnt') =>
  lista
    .map(
      (g) =>
        `<ideEstabLot>${ESTAB}<codLotacao>${g.codLotacao ?? 'LOT001'}</codLotacao>` +
        `<${remun}>${opcional('matricula', g.matricula)}${itens(g.itens)}</${remun}></ideEstabLot>`,
    )
    .join('');

export function umS1200(s: S1200Ficticio): string {
  const dmDev = s.dmDev
    .map((dm) => {
      const perApur = dm.grupos.length
        ? `<infoPerApur>${grupos(dm.grupos, 'remunPerApur')}</infoPerApur>`
        : '';
      const perAnt = dm.anteriores?.length
        ? '<infoPerAnt><ideADC><tpAcConv>A</tpAcConv><dsc>Acordo coletivo</dsc><remunSuc>N</remunSuc>' +
          dm.anteriores
            .map(
              (a) =>
                `<idePeriodo><perRef>${a.perRef}</perRef>${grupos(a.grupos, 'remunPerAnt')}</idePeriodo>`,
            )
            .join('') +
          '</ideADC></infoPerAnt>'
        : '';
      return `<dmDev><ideDmDev>${dm.ideDmDev}</ideDmDev><codCateg>${dm.codCateg ?? '101'}</codCateg>${perApur}${perAnt}</dmDev>`;
    })
    .join('');
  return (
    `<eSocial xmlns="${NS('evtRemun')}"><evtRemun Id="${s.id ?? umId()}">` +
    `<ideEvento><indRetif>${s.indRetif ?? '1'}</indRetif>${opcional('nrRecibo', s.nrRecibo)}` +
    `<indApuracao>${s.indApuracao ?? '1'}</indApuracao><perApur>${s.perApur ?? '2026-09'}</perApur>${PROC}</ideEvento>` +
    `${EMPREGADOR}<ideTrabalhador><cpfTrab>${s.cpf ?? '52998224725'}</cpfTrab></ideTrabalhador>` +
    `${dmDev}</evtRemun></eSocial>`
  );
}

export interface S1010Ficticio {
  id?: string;
  operacao?: 'inclusao' | 'alteracao' | 'exclusao';
  codRubr: string;
  ideTabRubr?: string;
  iniValid?: string;
  fimValid?: string;
  dscRubr?: string;
  natRubr?: string;
  /** 1 provento, 2 desconto, 3 informativa, 4 informativa dedutora. */
  tpRubr?: '1' | '2' | '3' | '4';
  codIncCP?: string;
  codIncIRRF?: string;
  codIncFGTS?: string;
  novaValidade?: { iniValid: string; fimValid?: string };
}

export function umS1010(r: S1010Ficticio): string {
  const operacao = r.operacao ?? 'inclusao';
  const ide =
    `<ideRubrica><codRubr>${r.codRubr}</codRubr><ideTabRubr>${r.ideTabRubr ?? '001'}</ideTabRubr>` +
    `<iniValid>${r.iniValid ?? '2026-01'}</iniValid>${opcional('fimValid', r.fimValid)}</ideRubrica>`;
  const dados =
    operacao === 'exclusao'
      ? ''
      : `<dadosRubrica><dscRubr>${r.dscRubr ?? `Rubrica ${r.codRubr}`}</dscRubr><natRubr>${r.natRubr ?? '1000'}</natRubr>` +
        `<tpRubr>${r.tpRubr ?? '1'}</tpRubr><codIncCP>${r.codIncCP ?? '11'}</codIncCP>` +
        `<codIncIRRF>${r.codIncIRRF ?? '11'}</codIncIRRF><codIncFGTS>${r.codIncFGTS ?? '11'}</codIncFGTS></dadosRubrica>`;
  const nova = r.novaValidade
    ? `<novaValidade><iniValid>${r.novaValidade.iniValid}</iniValid>${opcional('fimValid', r.novaValidade.fimValid)}</novaValidade>`
    : '';
  return (
    `<eSocial xmlns="${NS('evtTabRubrica')}"><evtTabRubrica Id="${r.id ?? umId(900)}">` +
    `<ideEvento>${PROC}</ideEvento>${EMPREGADOR}` +
    `<infoRubrica><${operacao}>${ide}${dados}${nova}</${operacao}></infoRubrica></evtTabRubrica></eSocial>`
  );
}
