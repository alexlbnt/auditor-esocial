import type { AchadoBruto, Achado, Severidade } from '../findings/tipos.ts';
import type { Leiaute, TipoEvento } from '../leiaute/eventos.ts';
import type { TabelasLeiaute } from '../leiaute/S-1.3/tabelas.ts';
import type { Auditoria } from '../model/tipos.ts';
import type { EventoReprovado } from '../xsd/validar-eventos.ts';

export interface ContextoRegra {
  auditoria: Readonly<Auditoria>;
  /** Interpretação dos códigos da versão do lote: a regra não importa tabela nenhuma. */
  tabelas: TabelasLeiaute;
  /**
   * Falso quando o lote não virou modelo (todos reprovados no XSD, competência a
   * escolher...): só rodam as regras com `independeDoModelo`.
   */
  modeloDisponivel: boolean;
  /** Resultado da etapa de XSD (só a R001 usa). */
  xsd: { executado: boolean; reprovados: readonly EventoReprovado[] };
}

export interface Regra {
  /** "R002", fixo para sempre. */
  codigo: string;
  /** Sobe quando a lógica muda. */
  versao: number;
  /** Linguagem de DP. */
  titulo: string;
  explicacao: string;
  sugestao: string;
  /** Padrão; a regra só pode rebaixar caso a caso. */
  severidade: Severidade;
  eventos: readonly TipoEvento[];
  /** Faixa de pacotes XSD em que vale (seção 4: o nome da versão não muda entre pacotes). */
  leiautes: { versao: Leiaute; pacoteDe: string; pacoteAte?: string };
  /** A regra depende da etapa de XSD: sem ela, vira "não executada". */
  requerXsd?: boolean;
  /** Roda mesmo sem modelo (a R001 só relata o XSD). */
  independeDoModelo?: boolean;
  /** Pura, síncrona e determinística. */
  executar(ctx: ContextoRegra): AchadoBruto[];
}

export type MotivoNaoExecutada =
  'leiaute-nao-suportado' | 'xsd-nao-executado' | 'modelo-indisponivel' | 'falhou';

export interface RegraNaoExecutada {
  codigo: string;
  versao: number;
  motivo: MotivoNaoExecutada;
  /** Só o nome do erro (ex.: TypeError): a mensagem pode conter dado do XML. */
  erro?: string;
}

export interface ResultadoMotor {
  achados: Achado[];
  regrasExecutadas: { codigo: string; versao: number }[];
  /** "R0xx não executada" no bloco "fora da auditoria". */
  naoExecutadas: RegraNaoExecutada[];
  duracaoMs: number;
}
