import type { AoProgredir, Progresso } from '@/core/progresso';

/**
 * Repassa o progresso no máximo a cada `intervaloMs`, mas sempre repassa a troca de
 * etapa e o fim de cada etapa (a tela nunca fica parada num número velho).
 * RNF-04: a tela recebe progresso pelo menos 1 vez por segundo sem ser inundada.
 */
export function limitarProgresso(
  repassar: (p: Progresso) => void,
  intervaloMs: number,
  agora: () => number,
): AoProgredir {
  let ultimoEnvio = -Infinity;
  let ultimaEtapa: Progresso['etapa'] | undefined;
  return (p) => {
    const t = agora();
    const mudouEtapa = p.etapa !== ultimaEtapa;
    const terminou = p.feitos === p.total;
    if (mudouEtapa || terminou || t - ultimoEnvio >= intervaloMs) {
      ultimoEnvio = t;
      ultimaEtapa = p.etapa;
      repassar(p);
    }
  };
}
