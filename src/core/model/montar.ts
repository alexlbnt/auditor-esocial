// DTOs por evento -> modelo canônico (seção 2 do doc). Quando uma Nota Técnica
// mudar um campo, muda o parser da versão e este montador; as regras não mudam.
import type { ItemFora } from '../ingest/tipos.ts';
import type {
  DtoGrupoRemun,
  DtoS1010,
  DtoS1200,
  DtoS2299,
  EventoLido,
} from '../parse/S-1.3/index.ts';
import { periodosDePagamento } from './competencia.ts';
import { paraCentavos, ValorMonetarioInvalido } from './dinheiro.ts';
import {
  chaveRubrica,
  type Auditoria,
  type ChaveRubrica,
  type Competencia,
  type Demonstrativo,
  type EventoFonte,
  type GrupoRemuneracao,
  type Origem,
  type Pagamento,
  type Pessoa,
  type Rubrica,
} from './tipos.ts';

export interface OpcoesMontagem {
  /** Escolhida pelo usuário quando o lote traz mais de uma competência. */
  competencia?: Competencia;
  pacoteXsd?: string;
}

export type ResultadoMontagem =
  | { tipo: 'pronta'; auditoria: Auditoria; foraDaAuditoria: ItemFora[] }
  /** 7.1: o MVP audita uma empresa por vez. */
  | { tipo: 'varios-empregadores'; raizes: string[] }
  /** 7.1: uma auditoria por competência + apuração; o usuário escolhe. */
  | { tipo: 'escolher-competencia'; competencias: Competencia[] }
  | { tipo: 'sem-remuneracao' };

/** tpPgto 3 = verbas rescisórias do S-2399 (TSV), fora do MVP (D-17). */
const TPPGTO_S2399 = '3';

type Lido<T extends EventoLido['tipo']> = Extract<EventoLido, { tipo: T }>;

const origemDe = (e: EventoLido, caminho?: string): Origem => ({
  arquivo: e.local.arquivo,
  posicaoNoLote: e.local.posicaoNoLote,
  eventoId: e.dto.id,
  tipo: e.tipo,
  ...(caminho ? { caminho } : {}),
});

/** Competência anual (13º) usa dezembro para conferir a validade da rubrica. */
// CONFERIR NO LEIAUTE S-1.3: validade do S-1010 (iniValid/fimValid, AAAA-MM) para a folha de 13º (perApur AAAA)
const mesDeValidade = (c: Competencia) => (c.length === 4 ? `${c}-12` : c);

const cobre = (v: { inicio: string; fim?: string }, mes: string) =>
  v.inicio <= mes && (v.fim === undefined || mes <= v.fim);

/**
 * Tabela de rubricas válida na competência, aplicando os S-1010 na ordem do lote.
 * Alteração troca os dados da validade identificada em `ideRubrica` (e a validade,
 * se houver `novaValidade`); exclusão remove aquela validade.
 */
// CONFERIR NO LEIAUTE S-1.3: semântica de alteracao/novaValidade e exclusao no S-1010 (MOS)
function montarRubricas(
  eventos: Lido<'S-1010'>[],
  competencia: Competencia,
): Map<ChaveRubrica, Rubrica> {
  const versoes = new Map<ChaveRubrica, Rubrica[]>();
  for (const e of eventos) {
    const op: DtoS1010['rubrica'] = e.dto.rubrica;
    const { codRubr, ideTabRubr, iniValid, fimValid } = op.ideRubrica;
    const chave = chaveRubrica(codRubr, ideTabRubr);
    const daChave = (versoes.get(chave) ?? []).filter(
      (r) => op.operacao === 'inclusao' || r.validade.inicio !== iniValid,
    );
    if (op.operacao !== 'exclusao') {
      const validade =
        op.operacao === 'alteracao' && op.novaValidade
          ? { inicio: op.novaValidade.iniValid, fim: op.novaValidade.fimValid }
          : { inicio: iniValid, fim: fimValid };
      const d = op.dadosRubrica;
      daChave.push({
        codigo: codRubr,
        tabela: ideTabRubr,
        descricao: d.dscRubr,
        natureza: d.natRubr,
        tipo: d.tpRubr,
        incidencias: {
          inss: d.codIncCP,
          irrf: d.codIncIRRF,
          fgts: d.codIncFGTS,
          ...(d.codIncCPRP ? { rpps: d.codIncCPRP } : {}),
        },
        validade: validade.fim ? validade : { inicio: validade.inicio },
        origem: origemDe(e),
      });
    }
    versoes.set(chave, daChave);
  }
  const mes = mesDeValidade(competencia);
  const rubricas = new Map<ChaveRubrica, Rubrica>();
  for (const chave of [...versoes.keys()].sort()) {
    // Mais de uma validade cobrindo o mês: vale a última do lote (o eSocial não aceitaria sobreposição).
    const valida = versoes
      .get(chave)
      ?.filter((r) => cobre(r.validade, mes))
      .at(-1);
    if (valida) rubricas.set(chave, valida);
  }
  return rubricas;
}

function grupoDoDto(
  e: Lido<'S-1200' | 'S-2299'>,
  g: DtoGrupoRemun,
  caminho: string,
  {
    tagItem = 'itensRemun',
    matricula = g.matricula,
  }: { tagItem?: string; matricula?: string } = {},
): GrupoRemuneracao {
  return {
    estabelecimento: g.nrInsc,
    lotacao: g.codLotacao,
    ...(matricula ? { matricula } : {}),
    ...(g.perRef ? { periodoAnterior: g.perRef } : {}),
    itens: g.itens.map((i, k) => ({
      rubrica: chaveRubrica(i.codRubr, i.ideTabRubr),
      valor: paraCentavos(i.vrRubr),
      ...(i.qtdRubr ? { quantidade: i.qtdRubr } : {}),
      ...(i.fatorRubr ? { fator: i.fatorRubr } : {}),
      ...(i.indApurIR ? { indApurIR: i.indApurIR } : {}),
      origem: origemDe(e, `${caminho}/${tagItem}[${k + 1}]`),
    })),
  };
}

function demonstrativosDoS1200(e: Lido<'S-1200'>): Demonstrativo[] {
  const dto: DtoS1200 = e.dto;
  return dto.dmDev.map((dm, d) => {
    const base = `dmDev[${d + 1}]`;
    return {
      id: dm.ideDmDev,
      fonte: 'RGPS',
      categoria: dm.codCateg,
      periodoReferencia: dto.ideEvento.perApur,
      grupos: [
        ...dm.perApur.map((g, i) => grupoDoDto(e, g, `${base}/infoPerApur/grupo[${i + 1}]`)),
        ...dm.perAnt.map((g, i) => grupoDoDto(e, g, `${base}/infoPerAnt/grupo[${i + 1}]`)),
      ],
      origem: origemDe(e, base),
    };
  });
}

/** D-17: verbas rescisórias. O S-1210 aponta com tpPgto 2 e perRef = mês do desligamento. */
function demonstrativosDoS2299(e: Lido<'S-2299'>): Demonstrativo[] {
  const dto: DtoS2299 = e.dto;
  const opcoes = { tagItem: 'detVerbas', matricula: dto.matricula };
  return dto.dmDev.map((dm, d) => {
    const base = `infoDeslig/verbasResc/dmDev[${d + 1}]`;
    return {
      id: dm.ideDmDev,
      fonte: 'rescisao',
      periodoReferencia: dto.dtDeslig.slice(0, 7),
      grupos: [
        ...dm.perApur.map((g, i) =>
          grupoDoDto(e, g, `${base}/infoPerApur/grupo[${i + 1}]`, opcoes),
        ),
        ...dm.perAnt.map((g, i) => grupoDoDto(e, g, `${base}/infoPerAnt/grupo[${i + 1}]`, opcoes)),
      ],
      origem: origemDe(e, base),
    };
  });
}

/**
 * Vigente = a versão que as regras de valor usam: entre os eventos com a mesma
 * chave, a última retificação do lote; sem retificação, o último original. Os
 * outros continuam em `eventos` para R005/R006 (ADR 0004).
 */
// CONFERIR NO LEIAUTE S-1.3: ordem entre retificações (data/hora do Id, D-10) em vez da ordem do lote
function vigentes<T extends EventoLido>(
  eventos: readonly T[],
  chave: (e: T) => string,
  retificacao: (e: T) => boolean,
): Set<T> {
  const porChave = new Map<string, T[]>();
  for (const e of eventos) porChave.set(chave(e), [...(porChave.get(chave(e)) ?? []), e]);
  const escolhidos = new Set<T>();
  for (const grupo of porChave.values()) {
    const retificacoes = grupo.filter(retificacao);
    const vencedor = (retificacoes.length ? retificacoes : grupo).at(-1);
    if (vencedor) escolhidos.add(vencedor);
  }
  return escolhidos;
}

const ordenarPorCpf = (pessoas: Map<string, Pessoa>) =>
  new Map([...pessoas].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

export function montarAuditoria(
  lidos: readonly EventoLido[],
  { competencia: escolhida, pacoteXsd }: OpcoesMontagem = {},
): ResultadoMontagem {
  const raizes = [
    ...new Set(lidos.map((e) => `${e.dto.empregador.tpInsc}|${e.dto.empregador.nrInsc}`)),
  ].sort();
  if (raizes.length > 1)
    return { tipo: 'varios-empregadores', raizes: raizes.map((r) => r.split('|')[1] ?? r) };

  const doTipo = <T extends EventoLido['tipo']>(tipo: T) =>
    lidos.filter((e): e is Lido<T> => e.tipo === tipo);
  const remuneracoes = doTipo('S-1200');
  const competencias = [...new Set(remuneracoes.map((e) => e.dto.ideEvento.perApur))].sort();
  if (competencias.length === 0) return { tipo: 'sem-remuneracao' };
  const competencia = escolhida ?? (competencias.length === 1 ? competencias[0] : undefined);
  if (!competencia || !competencias.includes(competencia))
    return { tipo: 'escolher-competencia', competencias };

  const foraDaAuditoria: ItemFora[] = [];
  const outraCompetencia = (e: EventoLido, detalhe: string) =>
    foraDaAuditoria.push({ ...e.local, motivo: 'outra-competencia', detalhe });
  const valorInvalido = (e: EventoLido, campo: string) =>
    foraDaAuditoria.push({ ...e.local, motivo: 'valor-invalido', detalhe: `${e.tipo} ${campo}` });

  const pessoas = new Map<string, Pessoa>();
  const pessoa = (cpf: string): Pessoa => {
    const existente = pessoas.get(cpf);
    if (existente) return existente;
    const nova: Pessoa = {
      cpf,
      vinculos: [],
      demonstrativos: [],
      pagamentos: [],
      desligamentos: [],
    };
    pessoas.set(cpf, nova);
    return nova;
  };

  const eventosS1010 = doTipo('S-1010');
  const eventos: EventoFonte[] = eventosS1010.map((e) => ({
    origem: origemDe(e),
    retificacao: false,
    vigente: true,
  }));

  // S-1200: só a competência auditada.
  const s1200 = remuneracoes.filter((e) => {
    if (e.dto.ideEvento.perApur === competencia) return true;
    outraCompetencia(e, e.dto.ideEvento.perApur);
    return false;
  });
  const s1200Vigentes = vigentes(
    s1200,
    (e) => `${e.dto.cpfTrab}|${e.dto.ideEvento.perApur}|${e.dto.ideEvento.indApuracao}`,
    (e) => e.dto.ideEvento.indRetif === '2',
  );
  for (const e of s1200) {
    const ide = e.dto.ideEvento;
    let demonstrativos: Demonstrativo[];
    try {
      demonstrativos = demonstrativosDoS1200(e);
    } catch (erro) {
      // Só sem XSD: o pacote oficial já recusa valor fora do formato.
      if (!(erro instanceof ValorMonetarioInvalido)) throw erro;
      valorInvalido(e, 'vrRubr');
      continue;
    }
    const vigente = s1200Vigentes.has(e);
    eventos.push({
      origem: origemDe(e),
      retificacao: ide.indRetif === '2',
      ...(ide.nrRecibo ? { nrRecibo: ide.nrRecibo } : {}),
      cpf: e.dto.cpfTrab,
      perApur: ide.perApur,
      indApuracao: ide.indApuracao,
      vigente,
    });
    if (!vigente) continue;
    const p = pessoa(e.dto.cpfTrab);
    p.demonstrativos.push(...demonstrativos);
    for (const [d, dm] of e.dto.dmDev.entries()) {
      for (const g of dm.perApur) {
        const ja = p.vinculos.some(
          (v) => v.matricula === g.matricula && v.categoria === dm.codCateg,
        );
        if (!ja) {
          p.vinculos.push({
            ...(g.matricula ? { matricula: g.matricula } : {}),
            categoria: dm.codCateg,
            regime: 'RGPS',
            origem: origemDe(e, `dmDev[${d + 1}]`),
          });
        }
      }
    }
  }

  // S-2299: não periódico, entram todos (R003 precisa de desligamentos anteriores).
  // Os demonstrativos de rescisão só entram se o desligamento é da competência auditada.
  const s2299 = doTipo('S-2299');
  const s2299Vigentes = vigentes(
    s2299,
    (e) => `${e.dto.cpfTrab}|${e.dto.matricula}`,
    (e) => e.dto.ideEvento.indRetif === '2',
  );
  for (const e of s2299) {
    const ide = e.dto.ideEvento;
    const mesDeslig = e.dto.dtDeslig.slice(0, 7);
    let demonstrativos: Demonstrativo[] = [];
    if (e.dto.dmDev.length > 0 && mesDeslig === competencia) {
      try {
        demonstrativos = demonstrativosDoS2299(e);
      } catch (erro) {
        if (!(erro instanceof ValorMonetarioInvalido)) throw erro;
        valorInvalido(e, 'vrRubr');
        continue;
      }
    } else if (e.dto.dmDev.length > 0 && s2299Vigentes.has(e)) {
      outraCompetencia(e, `verbas rescisórias de ${mesDeslig}`);
    }
    const vigente = s2299Vigentes.has(e);
    eventos.push({
      origem: origemDe(e),
      retificacao: ide.indRetif === '2',
      ...(ide.nrRecibo ? { nrRecibo: ide.nrRecibo } : {}),
      cpf: e.dto.cpfTrab,
      vigente,
    });
    if (!vigente) continue;
    const p = pessoa(e.dto.cpfTrab);
    p.desligamentos.push({ matricula: e.dto.matricula, data: e.dto.dtDeslig, origem: origemDe(e) });
    p.demonstrativos.push(...demonstrativos);
  }

  // S-1210: regime de caixa, perApur N ou N+1; liga ao demonstrativo por tpPgto + perRef + ideDmDev (D-16).
  const aceitaPagamento = periodosDePagamento(competencia);
  const s1210 = doTipo('S-1210').filter((e) => {
    if (aceitaPagamento(e.dto.ideEvento.perApur)) return true;
    outraCompetencia(e, e.dto.ideEvento.perApur);
    return false;
  });
  const s1210Vigentes = vigentes(
    s1210,
    (e) => `${e.dto.cpfBenef}|${e.dto.ideEvento.perApur}`,
    (e) => e.dto.ideEvento.indRetif === '2',
  );
  for (const e of s1210) {
    const ide = e.dto.ideEvento;
    let pagamentos: Pagamento[];
    try {
      pagamentos = e.dto.infoPgto.flatMap((pg, k): Pagamento[] => {
        if (pg.tpPgto === TPPGTO_S2399) {
          foraDaAuditoria.push({
            ...e.local,
            motivo: 'evento-fora-do-mvp',
            detalhe: `S-1210 infoPgto[${k + 1}] tpPgto 3 (S-2399)`,
          });
          return [];
        }
        return [
          {
            data: pg.dtPgto,
            periodoReferencia: pg.perRef,
            demonstrativoId: pg.ideDmDev,
            tipoPagamento: pg.tpPgto,
            liquido: paraCentavos(pg.vrLiq),
            origem: origemDe(e, `ideBenef/infoPgto[${k + 1}]`),
          },
        ];
      });
    } catch (erro) {
      if (!(erro instanceof ValorMonetarioInvalido)) throw erro;
      valorInvalido(e, 'vrLiq');
      continue;
    }
    const vigente = s1210Vigentes.has(e);
    eventos.push({
      origem: origemDe(e),
      retificacao: ide.indRetif === '2',
      ...(ide.nrRecibo ? { nrRecibo: ide.nrRecibo } : {}),
      cpf: e.dto.cpfBenef,
      perApur: ide.perApur,
      vigente,
    });
    if (vigente) pessoa(e.dto.cpfBenef).pagamentos.push(...pagamentos);
  }

  const [primeira] = raizes;
  const [tipoInscricao = '', raiz = ''] = (primeira ?? '').split('|');
  return {
    tipo: 'pronta',
    auditoria: {
      leiaute: 'S-1.3',
      ...(pacoteXsd ? { pacoteXsd } : {}),
      empregador: { tipoInscricao, raiz },
      competencia,
      apuracao: competencia.length === 4 ? 'anual' : 'mensal',
      eventos,
      rubricas: montarRubricas(eventosS1010, competencia),
      pessoas: ordenarPorCpf(pessoas),
    },
    foraDaAuditoria,
  };
}
