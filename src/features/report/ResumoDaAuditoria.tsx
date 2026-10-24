'use client';

import type { Severidade } from '@/core/findings/tipos';
import type { ResumoDaAuditoria as Resumo } from '@/workers/resumo';
import { formatarCompetencia, formatarQuantidade } from '@/shared/formatacao';
import { Botao } from '@/shared/ui/Botao';
import { Cartao } from '@/shared/ui/Cartao';
import { IconeSeveridade, rotuloSeveridade } from '@/shared/ui/IconeSeveridade';

const SEVERIDADES: Severidade[] = ['erro', 'alerta', 'info'];

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

/**
 * Resumo da auditoria (provisório): o relatório completo, com a lista por
 * trabalhador e o cartão do achado, chega na etapa 3.2.
 */
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

  const contagem = (s: Severidade) => resumo.achados.filter((a) => a.severidade === s).length;
  const comAchado = new Set(resumo.achados.map((a) => a.cpf).filter(Boolean));
  const semAchado = resumo.trabalhadores.filter((t) => !comAchado.has(t.cpf)).length;
  const xmls = Object.values(resumo.eventosPorTipo).reduce((n, x) => n + (x ?? 0), 0);

  return (
    <div className="space-y-6">
      <Cartao className="space-y-4">
        <h2 className="text-xl font-bold">
          {modelo.tipo === 'pronta'
            ? `Competência ${formatarCompetencia(modelo.competencia)}`
            : 'Nenhum evento sobrou para auditar'}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          {modelo.tipo === 'pronta' && (
            <div>
              <dt className="text-secundario">Empresa (raiz)</dt>
              <dd className="font-mono">{modelo.empregador}</dd>
            </div>
          )}
          <div>
            <dt className="text-secundario">Eventos auditados</dt>
            <dd className="tabular-nums">{formatarQuantidade(xmls)}</dd>
          </div>
          <div>
            <dt className="text-secundario">Trabalhadores</dt>
            <dd className="tabular-nums">{formatarQuantidade(resumo.trabalhadores.length)}</dd>
          </div>
          <div>
            <dt className="text-secundario">Pacote XSD</dt>
            <dd className="font-mono">{resumo.pacoteXsd ?? 'não validado'}</dd>
          </div>
        </dl>
        <ul className="flex flex-wrap gap-6" aria-label="Achados por severidade">
          {SEVERIDADES.map((s) => (
            <li key={s} className="flex items-center gap-2" data-testid={`total-${s}`}>
              <IconeSeveridade severidade={s} />
              <span className="text-2xl font-bold tabular-nums">
                {formatarQuantidade(contagem(s))}
              </span>
              <span>{rotuloSeveridade(s)}</span>
            </li>
          ))}
        </ul>
        {modelo.tipo === 'pronta' && (
          <p className="text-secundario">
            {formatarQuantidade(semAchado)} trabalhador(es) sem nenhum achado.
          </p>
        )}
        {resumo.semAssinatura > 0 && (
          <p className="text-sm text-secundario">
            Os XMLs vieram sem assinatura digital e foram validados sem ela.
          </p>
        )}
      </Cartao>

      <Cartao className="space-y-2">
        <h2 className="text-lg font-bold">Fora da auditoria</h2>
        {resumo.foraDaAuditoria.length === 0 && resumo.regrasNaoExecutadas.length === 0 ? (
          <p className="text-secundario">Tudo o que veio no lote foi auditado.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {resumo.foraDaAuditoria.length > 0 && (
              <li>
                {formatarQuantidade(resumo.foraDaAuditoria.length)} arquivo(s) ou evento(s) não
                auditados
              </li>
            )}
            {resumo.regrasNaoExecutadas.map((r) => (
              <li key={r.codigo}>
                <span className="font-mono">{r.codigo}</span> não executada
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Botao variante="secundario" onClick={aoRecomecar}>
        Nova auditoria
      </Botao>
    </div>
  );
}
