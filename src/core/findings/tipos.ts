import type { TipoEvento } from '../leiaute/eventos.ts';
import type { Competencia, Cpf, Origem } from '../model/tipos.ts';

export type Severidade = 'erro' | 'alerta' | 'info';

/** Ordem do mais grave para o mais leve. */
export const GRAVIDADE: Readonly<Record<Severidade, number>> = { erro: 0, alerta: 1, info: 2 };

/**
 * Valores do achado. **Número é sempre dinheiro em centavos** (a tela e as exportações
 * formatam como R$); contagens, datas e códigos vão como texto.
 */
export type Valores = Readonly<Record<string, string | number>>;

/** O que a regra devolve. Sem textos: título, explicação e sugestão vêm da regra. */
export interface AchadoBruto {
  /** Só para rebaixar a severidade padrão da regra (ex.: R002 com rubrica sem cadastro). */
  severidade?: Severidade;
  cpf?: Cpf;
  matricula?: string;
  origem: Origem;
  /** Campo do leiaute, para o usuário achar (ex.: `vrLiq`). */
  campo?: string;
  valores?: Valores;
  /** Agrupa achados que se resolvem com uma correção só (ex.: `rubrica:1050|001`). */
  causa?: string;
  /**
   * Distingue achados da mesma regra, CPF, campo e competência (ex.: o `ideDmDev`).
   * Entra na chave; precisa ser estável entre auditorias.
   */
  discriminador?: string;
}

/** Achado completo, só na memória do navegador (CPF sem máscara). */
export interface Achado {
  regra: string;
  regraVersao: number;
  severidade: Severidade;
  competencia: Competencia;
  cpf?: Cpf;
  matricula?: string;
  evento: TipoEvento;
  eventoId: string;
  arquivo: string;
  posicaoNoLote: number;
  caminho?: string;
  campo?: string;
  valores?: Valores;
  causa?: string;
  /** HMAC-SHA256 com o segredo da conta: identifica o mesmo achado entre auditorias. */
  chave: string;
}
