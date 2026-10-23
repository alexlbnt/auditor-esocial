import type { Leiaute, TipoEvento } from '../leiaute/eventos.ts';

/** Um arquivo como o usuário entregou (solto ou o próprio zip). */
export interface ArquivoEntrada {
  nome: string;
  bytes: Uint8Array;
}

/** Um evento identificado, ainda como texto: segue para o XSD (R001) e o parse. */
export interface EventoBruto {
  /** Caminho dentro do lote, ex.: `lote.zip/S1200/evento.xml`. */
  arquivo: string;
  /** Posição do evento dentro do arquivo (1 no evento solto). */
  posicaoNoLote: number;
  tipo: TipoEvento;
  leiaute: Leiaute;
  /** Namespace do evento: escolhe o esquema no pacote XSD. */
  namespace: string;
  /** Atributo `Id` do evento; vazio se ausente (o XSD acusa). */
  id: string;
  xml: string;
}

export type MotivoFora =
  | 'nao-xml'
  | 'xml-malformado'
  | 'encoding-nao-suportado'
  | 'xml-nao-reconhecido'
  | 'evento-fora-do-mvp'
  | 'leiaute-nao-suportado'
  | 'exclusao-nao-considerada'
  | 'zip-corrompido'
  | 'zip-aninhado'
  | 'xsd-indisponivel';

/** O que não foi auditado nunca some: vira uma linha do bloco "fora da auditoria". */
export interface ItemFora {
  arquivo: string;
  posicaoNoLote?: number;
  motivo: MotivoFora;
  /** Sem conteúdo do XML: só código, linha/coluna, nome do evento ou versão. */
  detalhe?: string;
}

export type LimiteRnf06 =
  'tamanho-descompactado' | 'quantidade-de-arquivos' | 'taxa-de-compressao' | 'tamanho-do-xml';

/** Lote recusado antes do processamento pesado (RNF-06). */
export interface Recusa {
  limite: LimiteRnf06;
  arquivo?: string;
  valor: number;
  maximo: number;
}

export type ResultadoIngest =
  { recusa: Recusa } | { recusa?: undefined; eventos: EventoBruto[]; foraDaAuditoria: ItemFora[] };
