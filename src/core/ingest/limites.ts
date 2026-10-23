const MB = 1024 * 1024;

export interface Limites {
  /** Soma dos arquivos depois de descompactar. */
  bytesDescompactados: number;
  /** Arquivos no lote, contando os de dentro dos zips. */
  arquivos: number;
  /** Tamanho original / tamanho compactado, por arquivo do zip. */
  taxaCompressao: number;
  /** Um XML sozinho. */
  bytesPorXml: number;
}

/** RNF-06: proteção contra zip-bomba e lote grande demais. */
export const LIMITES_RNF06: Readonly<Limites> = Object.freeze({
  bytesDescompactados: 150 * MB,
  arquivos: 50_000,
  taxaCompressao: 100,
  bytesPorXml: 10 * MB,
});
