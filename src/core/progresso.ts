/** Etapas mostradas na tela (HU-01): lendo, validando, montando, auditando. */
export type EtapaAuditoria = 'lendo' | 'validando' | 'montando' | 'auditando';

export interface Progresso {
  etapa: EtapaAuditoria;
  feitos: number;
  total: number;
}

/**
 * Chamado a cada item de cada etapa. O core não limita a frequência: quem mostra
 * na tela (o worker) decide quantas vezes por segundo repassa.
 */
export type AoProgredir = (progresso: Progresso) => void;
