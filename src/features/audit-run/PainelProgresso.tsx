'use client';

import type { EtapaAuditoria, Progresso } from '@/core/progresso';
import { formatarQuantidade } from '@/shared/formatacao';
import { Botao } from '@/shared/ui/Botao';
import { Cartao } from '@/shared/ui/Cartao';

const ETAPAS: { etapa: EtapaAuditoria; rotulo: string; unidade: string }[] = [
  { etapa: 'lendo', rotulo: 'Lendo os arquivos', unidade: 'arquivos' },
  { etapa: 'validando', rotulo: 'Validando no esquema do eSocial', unidade: 'eventos' },
  { etapa: 'montando', rotulo: 'Montando os trabalhadores', unidade: 'eventos' },
  { etapa: 'auditando', rotulo: 'Auditando as regras', unidade: 'regras' },
];

interface Props {
  progresso: Progresso | undefined;
  arquivos: number;
  aoCancelar: () => void;
}

/** HU-01: progresso por etapa com contagem, e cancelar. */
export function PainelProgresso({ progresso, arquivos, aoCancelar }: Props) {
  const indiceAtual = progresso ? ETAPAS.findIndex((e) => e.etapa === progresso.etapa) : 0;
  const atual = ETAPAS[indiceAtual] ?? ETAPAS[0];
  return (
    <Cartao className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Auditando {formatarQuantidade(arquivos)} arquivo(s)</h2>
        <p className="text-secundario">Tudo acontece neste computador. Nada é enviado.</p>
      </div>
      <ol className="space-y-3">
        {ETAPAS.map((e, i) => {
          const estado = i < indiceAtual ? 'feita' : i === indiceAtual ? 'atual' : 'pendente';
          const contagem =
            estado === 'atual' && progresso
              ? `${formatarQuantidade(progresso.feitos)} de ${formatarQuantidade(progresso.total)} ${e.unidade}`
              : estado === 'feita'
                ? 'pronto'
                : '';
          return (
            <li
              key={e.etapa}
              data-testid={`etapa-${e.etapa}`}
              data-estado={estado}
              className={`flex items-baseline justify-between gap-4 border-b border-linha pb-2 ${
                estado === 'pendente' ? 'text-secundario' : ''
              }`}
            >
              <span className={estado === 'atual' ? 'bg-grifo px-1 font-semibold' : ''}>
                {estado === 'feita' ? '✓ ' : ''}
                {e.rotulo}
              </span>
              <span className="font-mono text-sm tabular-nums">{contagem}</span>
            </li>
          );
        })}
      </ol>
      {progresso && progresso.total > 0 && (
        <div
          role="progressbar"
          aria-label={atual?.rotulo}
          aria-valuemin={0}
          aria-valuemax={progresso.total}
          aria-valuenow={progresso.feitos}
          className="h-2 w-full border border-tinta"
        >
          <div
            className="h-full bg-tinta"
            style={{ width: `${Math.floor((progresso.feitos * 100) / progresso.total)}%` }}
          />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {atual?.rotulo}
      </p>
      <Botao variante="secundario" onClick={aoCancelar}>
        Cancelar
      </Botao>
    </Cartao>
  );
}
