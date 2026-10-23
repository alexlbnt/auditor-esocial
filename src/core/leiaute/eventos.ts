export type TipoEvento = 'S-1010' | 'S-1200' | 'S-1202' | 'S-1207' | 'S-1210' | 'S-1299' | 'S-2299';

export type Leiaute = 'S-1.3';

/** Envelope do lote de envio. Confirmado no S-1200 real (22/10/2026). */
export const NS_LOTE_ENVIO = 'http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1';

/** Namespace de evento: `<prefixo><nome do evento>/<versão>`. Confirmado no S-1200 real. */
const NS_EVENTO = /^http:\/\/www\.esocial\.gov\.br\/schema\/evt\/(\w+)\/(v_\w+)$/;

/** Versão no namespace -> leiaute. `v_S_01_03_00` confirmado no S-1200 real. */
export const VERSOES_SUPORTADAS: Readonly<Record<string, Leiaute>> = {
  v_S_01_03_00: 'S-1.3',
};

/**
 * Nome do evento no namespace -> tipo do MVP. Confirmados pelo targetNamespace e pela
 * documentação dos XSDs oficiais (pacotes 2026-07-01 e 2026-10-26), em 23/10/2026.
 */
export const EVENTOS_DO_MVP: Readonly<Record<string, TipoEvento>> = {
  evtRemun: 'S-1200',
  evtTabRubrica: 'S-1010',
  evtRmnRPPS: 'S-1202',
  evtBenPrRP: 'S-1207',
  evtPgtos: 'S-1210',
  evtFechaEvPer: 'S-1299',
  evtDeslig: 'S-2299',
};

/** S-3000, fora do MVP: só gera o aviso "exclusões não consideradas". */
export const EVENTO_EXCLUSAO = 'evtExclusao';

export function lerNamespaceEvento(ns: string): { evento: string; versao: string } | undefined {
  const m = NS_EVENTO.exec(ns);
  if (!m?.[1] || !m[2]) return undefined;
  return { evento: m[1], versao: m[2] };
}
