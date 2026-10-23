// O core não enxerga o DOM nem o Node (tsconfig próprio). TextDecoder é padrão
// WHATWG e existe igual no navegador, no Web Worker e no Node; só ele entra aqui.
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean });
  readonly encoding: string;
  decode(input?: Uint8Array): string;
}
