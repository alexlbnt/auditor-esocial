/** Um pacote XSD oficial, identificado pela data de produção (seção 4 do doc). */
export interface PacoteXsd {
  /** Data de produção, ex.: `2026-07-01`. Vira `pacoteXsd` na auditoria. */
  data: string;
  /** Caminho relativo dentro do pacote -> conteúdo do .xsd. */
  arquivos: ReadonlyMap<string, Uint8Array>;
}

export interface ErroXsd {
  linha: number;
  coluna: number;
  /** Mensagem da libxml2. Pode citar valores do XML (até CPF): sanear antes de sair do navegador. */
  mensagem: string;
  /** XPath do elemento, quando a biblioteca informa. */
  caminho?: string;
}

export type ResultadoXsd =
  | { status: 'valido'; assinaturaAusente: boolean }
  | { status: 'invalido'; assinaturaAusente: boolean; erros: ErroXsd[]; total: number }
  | { status: 'sem-esquema' }
  /** XML que nem é bem-formado: erro de entrada, nunca R001. */
  | { status: 'malformado'; erros: ErroXsd[] };

/**
 * Interface trocável (plano B: API em C#). Nada fora de `core/xsd/` conhece a
 * biblioteca de validação.
 */
export interface Validador {
  readonly pacote: string;
  /** Valida o XML de um evento contra o esquema do namespace dele. */
  validar(xml: string, namespace: string): ResultadoXsd;
  /** Libera a memória do WebAssembly. Obrigatório ao terminar. */
  dispose(): void;
}

/** R001: até 5 mensagens por arquivo. */
export const MAX_ERROS_POR_EVENTO = 5;
