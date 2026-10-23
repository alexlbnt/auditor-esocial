import type { Competencia } from './tipos.ts';

/** `2026-12` -> `2027-01`. Só competência mensal (AAAA-MM). */
export function mesSeguinte(competencia: Competencia): Competencia {
  const [ano = '', mes = ''] = competencia.split('-');
  const a = parseInt(ano, 10);
  const m = parseInt(mes, 10);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Regime de caixa (7.1): a folha de N pode ser paga em N+1, então a auditoria de N
 * aceita S-1210 com `perApur` N ou N+1. No 13º (AAAA), aceita os meses de AAAA e
 * janeiro de AAAA+1.
 */
// CONFERIR NO LEIAUTE S-1.3: janela de perApur do S-1210 para a folha de 13º (perRef AAAA)
export function periodosDePagamento(competencia: Competencia): (perApur: string) => boolean {
  if (competencia.length === 4) {
    const janeiroSeguinte = `${parseInt(competencia, 10) + 1}-01`;
    return (perApur) => perApur.startsWith(`${competencia}-`) || perApur === janeiroSeguinte;
  }
  const seguinte = mesSeguinte(competencia);
  return (perApur) => perApur === competencia || perApur === seguinte;
}
