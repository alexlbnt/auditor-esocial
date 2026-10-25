'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import type { Severidade } from '@/core/findings/tipos';
import { REGRAS } from '@/core/rules/registry';
import type { ResumoDaAuditoria } from '@/workers/resumo';
import { formatarCompetencia, formatarQuantidade } from '@/shared/formatacao';
import { Cartao } from '@/shared/ui/Cartao';
import { IconeSeveridade, rotuloSeveridade } from '@/shared/ui/IconeSeveridade';
import { ListaVirtual } from '@/shared/ui/ListaVirtual';
import { CartaoDoAchado, type VerNoXml } from './CartaoDoAchado';
import { fraseDoAchado, rotuloRubrica } from './frases';
import {
  GRUPO_DO_LOTE,
  agruparPorTrabalhador,
  comecePorAqui,
  linhasFiltradas,
  type Linha,
} from './modelo-relatorio';
import { MOTIVO_FORA, MOTIVO_NAO_EXECUTADA } from './textos';

type Concluido = Extract<ResumoDaAuditoria, { tipo: 'concluido' }>;

const SEVERIDADES: Severidade[] = ['erro', 'alerta', 'info'];
const ALTURA_LINHA = 56;
const ALTURA_LISTA = 560;
const MAX_FORA_NA_TELA = 50;

const REGRA = new Map(REGRAS.map((r) => [r.codigo, r]));
const tituloDe = (codigo: string) => REGRA.get(codigo)?.titulo ?? codigo;

/** HU-02: entender em segundos o tamanho do problema. */
export function Relatorio({ resumo, aoVerNoXml }: { resumo: Concluido; aoVerNoXml: VerNoXml }) {
  /** Chave do achado aberto no cartão (HU-03). */
  const [aberto, setAberto] = useState<string | undefined>(undefined);
  const [severidades, setSeveridades] = useState<ReadonlySet<Severidade>>(new Set(SEVERIDADES));
  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca);

  const grupos = useMemo(
    () => agruparPorTrabalhador(resumo.achados, resumo.trabalhadores),
    [resumo.achados, resumo.trabalhadores],
  );
  const linhas = useMemo(
    () => linhasFiltradas(grupos, { severidades, busca: buscaAdiada }),
    [grupos, severidades, buscaAdiada],
  );
  const comece = useMemo(() => comecePorAqui(resumo.achados), [resumo.achados]);
  // Anterior/próximo andam pelos achados visíveis, na ordem da lista.
  const achadosVisiveis = useMemo(
    () => linhas.flatMap((l) => (l.tipo === 'achado' ? [l.achado] : [])),
    [linhas],
  );
  const indiceAberto = aberto ? achadosVisiveis.findIndex((a) => a.chave === aberto) : -1;
  const achadoAberto = achadosVisiveis[indiceAberto];
  const vizinho = (passo: number) => {
    const alvo = achadosVisiveis[indiceAberto + passo];
    return alvo ? () => setAberto(alvo.chave) : undefined;
  };

  const total = (s: Severidade) => resumo.achados.filter((a) => a.severidade === s).length;
  const comAchado = new Set(resumo.achados.map((a) => a.cpf).filter(Boolean));
  const semAchado = resumo.trabalhadores.filter((t) => !comAchado.has(t.cpf)).length;
  const eventos = Object.values(resumo.eventosPorTipo).reduce((n, x) => n + (x ?? 0), 0);
  const visiveis = linhas.filter((l) => l.tipo === 'achado').length;
  const { modelo } = resumo;

  const alternar = (s: Severidade) =>
    setSeveridades((atual) => {
      const nova = new Set(atual);
      if (nova.has(s)) nova.delete(s);
      else nova.add(s);
      return nova;
    });

  return (
    <div className="space-y-6">
      <Cartao className="space-y-4">
        <h1 className="text-2xl font-extrabold">
          {modelo.tipo === 'pronta'
            ? `Competência ${formatarCompetencia(modelo.competencia)}`
            : 'Nenhum evento sobrou para auditar'}
        </h1>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
          {modelo.tipo === 'pronta' && (
            <>
              <Dado rotulo="Empresa (raiz)" valor={modelo.empregador} mono />
              <Dado
                rotulo="Apuração"
                valor={modelo.apuracao === 'anual' ? 'Anual (13º)' : 'Mensal'}
              />
            </>
          )}
          <Dado rotulo="Eventos auditados" valor={formatarQuantidade(eventos)} />
          <Dado rotulo="Trabalhadores" valor={formatarQuantidade(resumo.trabalhadores.length)} />
          <Dado rotulo="Pacote XSD" valor={resumo.pacoteXsd ?? 'não validado'} mono />
        </dl>
        <ul className="flex flex-wrap gap-6" aria-label="Achados por severidade">
          {SEVERIDADES.map((s) => (
            <li key={s} className="flex items-center gap-2" data-testid={`total-${s}`}>
              <IconeSeveridade severidade={s} />
              <span className="text-2xl font-bold tabular-nums">
                {formatarQuantidade(total(s))}
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

      {comece && (
        <Cartao className="space-y-1">
          <h2 className="text-lg font-bold">Comece por aqui</h2>
          <p data-testid="comece-por-aqui">
            {comece.tipo === 'causa' ? (
              <>
                Corrija a{' '}
                <span className="bg-grifo px-1 font-mono">
                  {comece.causa.startsWith('rubrica:')
                    ? rotuloRubrica(comece.causa.slice('rubrica:'.length))
                    : comece.causa}
                </span>{' '}
                e resolva <strong>{formatarQuantidade(comece.quantidade)} achados</strong>.
              </>
            ) : (
              <>
                <span className="bg-grifo px-1 font-mono">{comece.regra}</span> ·{' '}
                {tituloDe(comece.regra)}:{' '}
                <strong>
                  {formatarQuantidade(comece.quantidade)}{' '}
                  {rotuloSeveridade(comece.severidade).toLowerCase()}(s)
                </strong>
                .
              </>
            )}
          </p>
        </Cartao>
      )}

      <section className="space-y-3" aria-labelledby="titulo-achados">
        <h2 id="titulo-achados" className="text-lg font-bold">
          Achados por trabalhador
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {SEVERIDADES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={severidades.has(s)}
              onClick={() => alternar(s)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-sm border border-tinta px-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta ${
                severidades.has(s) ? 'bg-tinta text-papel' : 'bg-papel text-tinta'
              }`}
            >
              <IconeSeveridade severidade={s} />
              {rotuloSeveridade(s)}
            </button>
          ))}
          <label className="flex min-w-64 flex-1 flex-col text-sm">
            <span className="text-secundario">Buscar por CPF, matrícula ou regra</span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="ex.: 529.982, 0001 ou R002"
              className="min-h-11 rounded-sm border border-tinta bg-papel px-3 font-mono focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            />
          </label>
        </div>
        <p className="text-sm text-secundario" aria-live="polite" data-testid="contagem-visivel">
          Mostrando {formatarQuantidade(visiveis)} de {formatarQuantidade(resumo.achados.length)}{' '}
          achado(s).
        </p>
        {resumo.achados.length === 0 ? (
          <p className="border border-tinta p-4">
            Nenhum problema encontrado nas regras executadas (
            {resumo.regrasExecutadas.map((r) => r.codigo).join(', ') || 'nenhuma'}).
          </p>
        ) : linhas.length === 0 ? (
          <p className="border border-tinta p-4">Nenhum achado com esses filtros.</p>
        ) : (
          <ListaVirtual
            itens={linhas}
            alturaLinha={ALTURA_LINHA}
            altura={ALTURA_LISTA}
            rotulo="Achados por trabalhador"
            chave={(l) => (l.tipo === 'grupo' ? `g:${l.grupo.id}` : `a:${l.achado.chave}`)}
            renderizar={(l) => <LinhaDoRelatorio linha={l} aoAbrir={setAberto} />}
          />
        )}
      </section>

      <Cartao className="space-y-2">
        <h2 className="text-lg font-bold">Fora da auditoria</h2>
        {resumo.foraDaAuditoria.length === 0 && resumo.regrasNaoExecutadas.length === 0 ? (
          <p className="text-secundario">Tudo o que veio no lote foi auditado.</p>
        ) : (
          <ul className="space-y-1 text-sm" data-testid="fora-da-auditoria">
            {resumo.regrasNaoExecutadas.map((r) => (
              <li key={r.codigo}>
                <span className="font-mono">{r.codigo}</span> não executada:{' '}
                {MOTIVO_NAO_EXECUTADA[r.motivo]}
              </li>
            ))}
            {resumo.foraDaAuditoria.slice(0, MAX_FORA_NA_TELA).map((f, i) => (
              <li key={`${f.arquivo}#${f.posicaoNoLote ?? 0}#${i}`}>
                <span className="font-mono">
                  {f.arquivo}
                  {f.posicaoNoLote ? ` #${f.posicaoNoLote}` : ''}
                </span>
                : {MOTIVO_FORA[f.motivo]}
                {f.detalhe ? ` (${f.detalhe})` : ''}
              </li>
            ))}
            {resumo.foraDaAuditoria.length > MAX_FORA_NA_TELA && (
              <li className="text-secundario">
                e mais {formatarQuantidade(resumo.foraDaAuditoria.length - MAX_FORA_NA_TELA)}.
              </li>
            )}
          </ul>
        )}
      </Cartao>

      {achadoAberto && (
        <CartaoDoAchado
          key={achadoAberto.chave}
          achado={achadoAberto}
          regra={REGRA.get(achadoAberto.regra)}
          posicao={{ atual: indiceAberto + 1, total: achadosVisiveis.length }}
          aoAnterior={vizinho(-1)}
          aoProximo={vizinho(1)}
          aoFechar={() => setAberto(undefined)}
          aoVerNoXml={aoVerNoXml}
        />
      )}
    </div>
  );
}

function Dado({ rotulo, valor, mono = false }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-secundario">{rotulo}</dt>
      <dd className={mono ? 'font-mono' : 'tabular-nums'}>{valor}</dd>
    </div>
  );
}

function LinhaDoRelatorio({ linha, aoAbrir }: { linha: Linha; aoAbrir: (chave: string) => void }) {
  if (linha.tipo === 'grupo') {
    const { grupo } = linha;
    return (
      <div className="flex h-full items-center gap-3 border-b border-tinta bg-linha/60 px-4">
        <IconeSeveridade severidade={grupo.pior} />
        <span
          className={`whitespace-nowrap font-semibold ${grupo.id === GRUPO_DO_LOTE ? '' : 'font-mono'}`}
        >
          {grupo.rotulo}
        </span>
        {grupo.matriculas.length > 0 && (
          <span className="truncate font-mono text-sm text-secundario">
            matr. {grupo.matriculas.join(', ')}
          </span>
        )}
        <span className="ml-auto hidden shrink-0 text-sm text-secundario sm:inline">
          {formatarQuantidade(linha.visiveis)} achado(s)
        </span>
      </div>
    );
  }
  const { achado } = linha;
  const titulo = tituloDe(achado.regra) ?? achado.regra;
  return (
    <button
      type="button"
      onClick={() => aoAbrir(achado.chave)}
      className="flex h-full w-full items-center gap-3 border-b border-linha px-4 pl-8 text-left hover:bg-grifo/30 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-tinta"
      data-testid="linha-achado"
    >
      <IconeSeveridade severidade={achado.severidade} />
      <span className="sr-only">{rotuloSeveridade(achado.severidade)}</span>
      <span className="w-12 shrink-0 font-mono text-sm">{achado.regra}</span>
      <span className="line-clamp-2 text-sm" title={titulo}>
        {fraseDoAchado(achado, titulo)}
      </span>
      <span className="ml-auto hidden shrink-0 font-mono text-xs text-secundario sm:inline">
        {achado.evento}
      </span>
    </button>
  );
}
