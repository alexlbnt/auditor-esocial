'use client';

import type { ResumoDaAuditoria as Resumo } from '@/workers/resumo';
import { formatarCompetencia, formatarQuantidade } from '@/shared/formatacao';
import { Botao } from '@/shared/ui/Botao';
import { Cartao } from '@/shared/ui/Cartao';
import { Relatorio } from './Relatorio';

const LIMITE: Record<string, string> = {
  'tamanho-descompactado': 'tamanho total descompactado',
  'quantidade-de-arquivos': 'quantidade de arquivos',
  'taxa-de-compressao': 'taxa de compressão',
  'tamanho-do-xml': 'tamanho de um XML',
};

interface Props {
  resumo: Resumo;
  aoEscolherCompetencia: (competencia: string) => void;
  aoRecomecar: () => void;
}

/** Resultado da auditoria: lote recusado, escolha de competência/empresa, ou o relatório. */
export function ResumoDaAuditoria({ resumo, aoEscolherCompetencia, aoRecomecar }: Props) {
  if (resumo.tipo === 'recusado') {
    const { limite, valor, maximo } = resumo.recusa;
    return (
      <Cartao className="space-y-4">
        <h2 className="text-xl font-bold">Este lote passa do limite</h2>
        <p>
          O limite de {LIMITE[limite] ?? limite} é {formatarQuantidade(maximo)}, e o lote tem{' '}
          {formatarQuantidade(valor)}. Divida o lote e audite em partes.
        </p>
        <Botao onClick={aoRecomecar}>Escolher outros arquivos</Botao>
      </Cartao>
    );
  }

  const { modelo } = resumo;
  if (modelo.tipo === 'escolher-competencia') {
    return (
      <Cartao className="space-y-4">
        <h2 className="text-xl font-bold">O lote tem mais de uma competência</h2>
        <p>Cada auditoria é de uma competência. Escolha qual auditar agora:</p>
        <div className="flex flex-wrap gap-3">
          {modelo.competencias.map((c) => (
            <Botao key={c} variante="secundario" onClick={() => aoEscolherCompetencia(c)}>
              {formatarCompetencia(c)}
            </Botao>
          ))}
        </div>
      </Cartao>
    );
  }
  if (modelo.tipo === 'varios-empregadores') {
    return (
      <Cartao className="space-y-4">
        <h2 className="text-xl font-bold">O lote tem mais de uma empresa</h2>
        <p>
          Cada auditoria é de uma empresa (raiz do CNPJ). Encontramos: {modelo.raizes.join(', ')}.
        </p>
        <Botao onClick={aoRecomecar}>Escolher outros arquivos</Botao>
      </Cartao>
    );
  }

  return (
    <div className="space-y-6">
      <Relatorio resumo={resumo} />
      <Botao variante="secundario" onClick={aoRecomecar}>
        Nova auditoria
      </Botao>
    </div>
  );
}
