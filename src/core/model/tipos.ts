// Modelo canônico (seção 2 do doc): a única coisa que as regras enxergam.
import type { Leiaute, TipoEvento } from '../leiaute/eventos.ts';
import type { Centavos } from './dinheiro.ts';

export type { Centavos } from './dinheiro.ts';
/** `AAAA-MM` (mensal) ou `AAAA` (13º), como no `perApur` (XSD: TS_perApur). */
export type Competencia = string;
export type DataISO = string;
/** 11 dígitos, sem máscara. Só existe na memória do navegador. */
export type Cpf = string;
/** `${codRubr}|${ideTabRubr}` */
export type ChaveRubrica = string;

export const chaveRubrica = (codigo: string, tabela: string): ChaveRubrica => `${codigo}|${tabela}`;

export interface Origem {
  arquivo: string;
  posicaoNoLote: number;
  eventoId: string;
  tipo: TipoEvento;
  /** Ex.: `dmDev[1]/infoPerApur/ideEstabLot[1]/remunPerApur[1]/itensRemun[2]`. */
  caminho?: string;
}

/** Todo evento lido, inclusive retificações e duplicados: R005/R006 olham todos. */
export interface EventoFonte {
  origem: Origem;
  retificacao: boolean;
  nrRecibo?: string;
  cpf?: Cpf;
  perApur?: Competencia;
  indApuracao?: string;
  /** Versão usada pelas regras de valor (a retificação mais recente). Ver ADR 0004. */
  vigente: boolean;
}

export interface Rubrica {
  codigo: string;
  tabela: string;
  descricao: string;
  /** `natRubr` cru (Tabela 03). */
  natureza: string;
  /** `tpRubr` cru; interpretado por `TabelasLeiaute.tipoRubrica`. */
  tipo: string;
  /** Códigos crus de `codIncCP`, `codIncIRRF`, `codIncFGTS`, `codIncCPRP`. */
  incidencias: { inss: string; irrf: string; fgts: string; rpps?: string };
  validade: { inicio: Competencia; fim?: Competencia };
  origem: Origem;
}

export interface ItemRubrica {
  rubrica: ChaveRubrica;
  valor: Centavos;
  /** `qtdRubr` e `fatorRubr` como texto: não são dinheiro e nenhuma regra soma. */
  quantidade?: string;
  fator?: string;
  indApurIR?: string;
  origem: Origem;
}

export interface GrupoRemuneracao {
  /** `nrInsc` do estabelecimento (texto: CNPJ pode ser alfanumérico). */
  estabelecimento: string;
  lotacao: string;
  matricula?: string;
  /** Só nos grupos de `infoPerAnt`: competência da diferença. Ausente = competência auditada. */
  periodoAnterior?: Competencia;
  itens: ItemRubrica[];
}

/**
 * Fonte do demonstrativo, que é também o `tpPgto` que o S-1210 usa para apontar
 * para ele (D-16): RGPS = S-1200 (1), rescisao = S-2299 (2), RPPS = S-1202 (4),
 * beneficio = S-1207 (5).
 */
export type FonteDemonstrativo = 'RGPS' | 'rescisao' | 'RPPS' | 'beneficio';

export interface Demonstrativo {
  /** `ideDmDev` */
  id: string;
  fonte: FonteDemonstrativo;
  categoria?: string;
  grupos: GrupoRemuneracao[];
  periodoReferencia: Competencia;
  beneficio?: string;
  origem: Origem;
}

export interface Pagamento {
  data: DataISO;
  periodoReferencia: Competencia;
  demonstrativoId: string;
  /** `tpPgto` cru. */
  tipoPagamento: string;
  liquido: Centavos;
  origem: Origem;
}

export interface Desligamento {
  matricula?: string;
  data: DataISO;
  origem: Origem;
}

export interface Vinculo {
  matricula?: string;
  categoria?: string;
  regime: 'RGPS' | 'RPPS';
  origem: Origem;
}

export interface Pessoa {
  cpf: Cpf;
  vinculos: Vinculo[];
  demonstrativos: Demonstrativo[];
  pagamentos: Pagamento[];
  desligamentos: Desligamento[];
}

export interface Auditoria {
  leiaute: Leiaute;
  /** Data do pacote XSD usado; ausente se o XSD não rodou. */
  pacoteXsd?: string;
  empregador: { tipoInscricao: string; raiz: string };
  competencia: Competencia;
  apuracao: 'mensal' | 'anual';
  eventos: EventoFonte[];
  /** S-1010 com validade que cobre a competência. */
  rubricas: ReadonlyMap<ChaveRubrica, Rubrica>;
  pessoas: ReadonlyMap<Cpf, Pessoa>;
  fechamento?: { origem: Origem };
}
