import type { Severidade } from '@/core/findings/tipos';

const ROTULO: Record<Severidade, string> = { erro: 'Erro', alerta: 'Alerta', info: 'Info' };
const COR: Record<Severidade, string> = {
  erro: 'text-erro',
  alerta: 'text-alerta',
  info: 'text-info',
};

/** Severidade nunca só por cor: Erro = círculo, Alerta = triângulo, Info = quadrado. */
export function IconeSeveridade({
  severidade,
  tamanho = 14,
}: {
  severidade: Severidade;
  tamanho?: number;
}) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 14 14"
      className={`inline-block shrink-0 ${COR[severidade]}`}
      aria-hidden="true"
    >
      {severidade === 'erro' && <circle cx="7" cy="7" r="6" fill="currentColor" />}
      {severidade === 'alerta' && <path d="M7 1 L13 13 L1 13 Z" fill="currentColor" />}
      {severidade === 'info' && <rect x="1.5" y="1.5" width="11" height="11" fill="currentColor" />}
    </svg>
  );
}

export const rotuloSeveridade = (s: Severidade) => ROTULO[s];
