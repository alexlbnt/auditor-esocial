// Orquestra a auditoria: ingest -> XSD -> parse -> modelo -> regras (R001 relata o XSD).
// O mesmo caminho roda no navegador (worker), no Vitest e no audit-cli.
import { lerLote, LIMITES_RNF06, type Limites } from './ingest/index.ts';
import type { ArquivoEntrada, EventoBruto, ItemFora, Recusa } from './ingest/tipos.ts';
import { montarAuditoria, type ResultadoMontagem } from './model/montar.ts';
import type { Auditoria, Competencia } from './model/tipos.ts';
import { lerEventos } from './parse/S-1.3/index.ts';
import { TABELAS_S_1_3 } from './leiaute/S-1.3/tabelas.ts';
import { executarRegras } from './rules/engine.ts';
import { REGRAS } from './rules/registry.ts';
import type { Regra, ResultadoMotor } from './rules/tipos.ts';
import type { Validador } from './xsd/tipos.ts';
import { validarEventos, type EventoReprovado } from './xsd/validar-eventos.ts';

export interface OpcoesAuditoria {
  /** Sem validador, a R001 não roda e isso fica registrado (`xsd: 'nao-executado'`). */
  validador?: Validador;
  limites?: Readonly<Limites>;
  /** Competência escolhida quando o lote traz mais de uma. */
  competencia?: Competencia;
  /**
   * Segredo da chave HMAC dos achados (da conta ou da sessão). Sem ele as regras
   * não rodam: um segredo fixo deixaria a chave reversível por força bruta.
   */
  segredo?: Uint8Array;
  /** Para `duracaoMs` do motor. */
  relogio?: () => number;
  /** Catálogo; padrão: todas as regras do MVP. */
  regras?: readonly Regra[];
}

/** Evento que passou pelo XSD, sem o texto do XML (que não fica em memória, RNF-05). */
export type EventoAuditado = Omit<EventoBruto, 'xml'>;

export type ResultadoAuditoria =
  | { recusa: Recusa }
  | {
      recusa?: undefined;
      /** Aprovados no XSD (ou todos, se o XSD não rodou). */
      eventos: EventoAuditado[];
      /** R001: reprovados no XSD, fora do modelo. */
      reprovados: EventoReprovado[];
      foraDaAuditoria: ItemFora[];
      xsd: 'validado' | 'nao-executado';
      pacoteXsd?: string;
      /** D-08: eventos aceitos sem assinatura digital. */
      semAssinatura: number;
      /** Modelo canônico pronto, ou o que impede montá-lo (escolher competência etc.). */
      modelo: ResultadoMontagem;
      /** Achados das regras; ausente só se não houve segredo. */
      motor?: ResultadoMotor;
    };

const porLugar = (a: ItemFora, b: ItemFora) =>
  a.arquivo < b.arquivo
    ? -1
    : a.arquivo > b.arquivo
      ? 1
      : (a.posicaoNoLote ?? 0) - (b.posicaoNoLote ?? 0);

const semXml = (e: EventoBruto): EventoAuditado => ({
  arquivo: e.arquivo,
  posicaoNoLote: e.posicaoNoLote,
  tipo: e.tipo,
  leiaute: e.leiaute,
  namespace: e.namespace,
  id: e.id,
});

export function auditar(
  entradas: readonly ArquivoEntrada[],
  {
    validador,
    limites = LIMITES_RNF06,
    competencia,
    segredo,
    relogio,
    regras = REGRAS,
  }: OpcoesAuditoria = {},
): ResultadoAuditoria {
  const lote = lerLote(entradas, limites);
  if (lote.recusa) return { recusa: lote.recusa };

  const validacao = validador ? validarEventos(lote.eventos, validador) : undefined;
  const aprovados = validacao ? validacao.aprovados : lote.eventos;
  const leitura = lerEventos(aprovados);
  const modelo = montarAuditoria(leitura.lidos, {
    ...(competencia ? { competencia } : {}),
    ...(validacao ? { pacoteXsd: validacao.pacoteXsd } : {}),
  });

  // Sem modelo (todos reprovados, competência a escolher...), as regras rodam sobre uma
  // auditoria vazia: a R001 ainda relata o XSD e as outras ficam "não executadas".
  const pacoteXsd = validacao?.pacoteXsd;
  const auditoria: Auditoria =
    modelo.tipo === 'pronta'
      ? modelo.auditoria
      : {
          leiaute: 'S-1.3',
          ...(pacoteXsd ? { pacoteXsd } : {}),
          empregador: { tipoInscricao: '', raiz: '' },
          competencia: competencia ?? '',
          apuracao: 'mensal',
          eventos: [],
          rubricas: new Map(),
          pessoas: new Map(),
        };
  const motor = segredo
    ? executarRegras(
        regras,
        {
          auditoria,
          tabelas: TABELAS_S_1_3,
          modeloDisponivel: modelo.tipo === 'pronta',
          xsd: { executado: Boolean(validacao), reprovados: validacao?.reprovados ?? [] },
        },
        { segredo, ...(relogio ? { relogio } : {}) },
      )
    : undefined;

  return {
    eventos: aprovados.map(semXml),
    reprovados: validacao?.reprovados ?? [],
    foraDaAuditoria: [
      ...lote.foraDaAuditoria,
      ...(validacao?.foraDaAuditoria ?? []),
      ...leitura.foraDaAuditoria,
      ...(modelo.tipo === 'pronta' ? modelo.foraDaAuditoria : []),
    ].sort(porLugar),
    xsd: validacao ? 'validado' : 'nao-executado',
    ...(validacao ? { pacoteXsd: validacao.pacoteXsd } : {}),
    semAssinatura: validacao?.semAssinatura ?? 0,
    modelo,
    ...(motor ? { motor } : {}),
  };
}
