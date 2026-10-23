// Orquestra a auditoria: ingest -> XSD (R001) -> [parse -> modelo -> regras, etapas 1.3+].
// O mesmo caminho roda no navegador (worker), no Vitest e no audit-cli.
import { lerLote, LIMITES_RNF06, type Limites } from './ingest/index.ts';
import type { ArquivoEntrada, EventoBruto, ItemFora, Recusa } from './ingest/tipos.ts';
import type { Validador } from './xsd/tipos.ts';
import { validarEventos, type EventoReprovado } from './xsd/validar-eventos.ts';

export interface OpcoesAuditoria {
  /** Sem validador, a R001 não roda e isso fica registrado (`xsd: 'nao-executado'`). */
  validador?: Validador;
  limites?: Readonly<Limites>;
}

export type ResultadoAuditoria =
  | { recusa: Recusa }
  | {
      recusa?: undefined;
      /** Eventos que seguem para o parse: aprovados no XSD, ou todos se o XSD não rodou. */
      eventos: EventoBruto[];
      /** R001: reprovados no XSD, fora do modelo. */
      reprovados: EventoReprovado[];
      foraDaAuditoria: ItemFora[];
      xsd: 'validado' | 'nao-executado';
      pacoteXsd?: string;
      /** D-08: eventos aceitos sem assinatura digital. */
      semAssinatura: number;
    };

const porLugar = (a: ItemFora, b: ItemFora) =>
  a.arquivo < b.arquivo
    ? -1
    : a.arquivo > b.arquivo
      ? 1
      : (a.posicaoNoLote ?? 0) - (b.posicaoNoLote ?? 0);

export function auditar(
  entradas: readonly ArquivoEntrada[],
  { validador, limites = LIMITES_RNF06 }: OpcoesAuditoria = {},
): ResultadoAuditoria {
  const lote = lerLote(entradas, limites);
  if (lote.recusa) return { recusa: lote.recusa };

  if (!validador) {
    return {
      eventos: lote.eventos,
      reprovados: [],
      foraDaAuditoria: lote.foraDaAuditoria,
      xsd: 'nao-executado',
      semAssinatura: 0,
    };
  }

  const validacao = validarEventos(lote.eventos, validador);
  return {
    eventos: validacao.aprovados,
    reprovados: validacao.reprovados,
    foraDaAuditoria: [...lote.foraDaAuditoria, ...validacao.foraDaAuditoria].sort(porLugar),
    xsd: 'validado',
    pacoteXsd: validacao.pacoteXsd,
    semAssinatura: validacao.semAssinatura,
  };
}
