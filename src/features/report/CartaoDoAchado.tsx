'use client';

import { useEffect, useRef, useState } from 'react';
import { mascararCpf } from '@/core/findings/cpf';
import type { Achado } from '@/core/findings/tipos';
import type { Regra } from '@/core/rules/tipos';
import type { TrechoDoXml } from '@/workers/trecho-xml';
import { formatarCompetencia, formatarReais } from '@/shared/formatacao';
import { Botao } from '@/shared/ui/Botao';
import { IconeSeveridade, rotuloSeveridade } from '@/shared/ui/IconeSeveridade';
import { fraseDoAchado, rotuloRubrica } from './frases';

export type VerNoXml = (
  achado: Achado,
) => Promise<TrechoDoXml | { erro: 'arquivo-nao-encontrado' | 'evento-nao-encontrado' }>;

interface Props {
  achado: Achado;
  regra: Regra | undefined;
  /** "3 de 12": posição nos achados visíveis com os filtros atuais. */
  posicao: { atual: number; total: number };
  aoAnterior: (() => void) | undefined;
  aoProximo: (() => void) | undefined;
  aoFechar: () => void;
  aoVerNoXml: VerNoXml;
}

const ROTULO_VALOR: Record<string, string> = {
  esperado: 'Esperado (proventos − descontos)',
  encontrado: 'Encontrado',
  diferenca: 'Diferença',
  proventos: 'Proventos',
  descontos: 'Descontos',
  pagamentos: 'Pagamentos ligados ao demonstrativo',
  rubricasSemCadastro: 'Rubricas sem cadastro no S-1010',
  dataDesligamento: 'Data do desligamento',
  competencia: 'Competência auditada',
  natureza: 'Natureza da rubrica (Tabela 03)',
  rubrica: 'Rubrica',
  fonte: 'Fonte da tabela',
  total: 'Erros de estrutura',
  demonstrativos: 'Demonstrativos não conferidos',
};

const OCULTOS = new Set(['motivo']);
const DINHEIRO = /(-?R\$ [\d.]+,\d{2})/;

/** A frase com os valores em reais grifados (marca-texto). Só texto, sem HTML. */
function FraseGrifada({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(DINHEIRO).map((parte, i) =>
        DINHEIRO.test(parte) ? (
          <mark key={i} className="bg-grifo px-0.5 text-tinta">
            {parte}
          </mark>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  );
}

function formatarValor(nome: string, valor: string | number): string {
  if (typeof valor === 'number') return formatarReais(valor);
  if (nome === 'competencia') return formatarCompetencia(valor);
  if (nome === 'dataDesligamento') return valor.split('-').reverse().join('/');
  if (nome === 'rubrica') return rotuloRubrica(valor);
  if (nome === 'rubricasSemCadastro') return valor.split(', ').map(rotuloRubrica).join(', ');
  return valor;
}

/** HU-03: entender um achado. */
export function CartaoDoAchado({
  achado,
  regra,
  posicao,
  aoAnterior,
  aoProximo,
  aoFechar,
  aoVerNoXml,
}: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [trecho, setTrecho] = useState<
    | { estado: 'fechado' }
    | { estado: 'lendo' }
    | { estado: 'pronto'; trecho: TrechoDoXml }
    | { estado: 'erro' }
  >({ estado: 'fechado' });

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
  }, []);

  const titulo = regra?.titulo ?? achado.regra;
  const valores = Object.entries(achado.valores ?? {}).filter(([nome]) => !OCULTOS.has(nome));
  const mensagensXsd = valores.filter(([nome]) => /^erro\d+$/.test(nome));
  const outrosValores = valores.filter(([nome]) => !/^erro\d+$/.test(nome));

  const verNoXml = async () => {
    setTrecho({ estado: 'lendo' });
    const r = await aoVerNoXml(achado);
    setTrecho('erro' in r ? { estado: 'erro' } : { estado: 'pronto', trecho: r });
  };

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby="titulo-do-achado"
      className="m-auto max-h-[90vh] w-[min(56rem,calc(100vw-2rem))] overflow-y-auto border border-tinta bg-papel p-0 text-tinta shadow-[4px_4px_0_var(--color-tinta)] backdrop:bg-tinta/40"
    >
      <div className="space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <IconeSeveridade severidade={achado.severidade} />
            <span className="font-semibold">{rotuloSeveridade(achado.severidade)}</span>
            <span className="font-mono">
              {achado.regra} v{achado.regraVersao}
            </span>
            <span className="text-secundario">· {titulo}</span>
          </p>
          <span className="text-sm text-secundario">
            {posicao.atual} de {posicao.total}
          </span>
        </header>

        <h2 id="titulo-do-achado" className="text-xl font-bold leading-snug">
          <FraseGrifada texto={fraseDoAchado(achado, titulo)} />
        </h2>

        {outrosValores.length > 0 && (
          <section aria-labelledby="o-que-vimos">
            <h3 id="o-que-vimos" className="mb-2 font-bold">
              O que vimos
            </h3>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {outrosValores.map(([nome, valor]) => (
                <div key={nome} className="border border-linha p-3">
                  <dt className="text-sm text-secundario">{ROTULO_VALOR[nome] ?? nome}</dt>
                  <dd className="font-mono tabular-nums">{formatarValor(nome, valor)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {mensagensXsd.length > 0 && (
          <section aria-labelledby="mensagens-xsd">
            <h3 id="mensagens-xsd" className="mb-2 font-bold">
              Mensagens do esquema
            </h3>
            <ul className="space-y-1 font-mono text-sm">
              {mensagensXsd.map(([nome, valor]) => (
                <li key={nome} className="break-words">
                  {String(valor)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {regra && (
          <div className="grid gap-4 sm:grid-cols-2">
            <section aria-labelledby="por-que">
              <h3 id="por-que" className="mb-1 font-bold">
                Por que importa
              </h3>
              <p>{regra.explicacao}</p>
            </section>
            <section aria-labelledby="como-corrigir">
              <h3 id="como-corrigir" className="mb-1 font-bold">
                Como corrigir
              </h3>
              <p>{regra.sugestao}</p>
            </section>
          </div>
        )}

        <section aria-labelledby="onde-esta">
          <h3 id="onde-esta" className="mb-2 font-bold">
            Onde está
          </h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {achado.cpf && (
              <Item
                rotulo="Trabalhador"
                valor={`${mascararCpf(achado.cpf)}${achado.matricula ? ` · matr. ${achado.matricula}` : ''}`}
              />
            )}
            <Item rotulo="Arquivo" valor={achado.arquivo} />
            <Item
              rotulo="Evento"
              valor={`${achado.evento} · posição ${achado.posicaoNoLote} no arquivo`}
            />
            <Item rotulo="Id do evento" valor={achado.eventoId} />
            {achado.campo && <Item rotulo="Campo" valor={achado.campo} />}
          </dl>
        </section>

        <section aria-labelledby="ver-no-xml" className="space-y-2">
          <h3 id="ver-no-xml" className="font-bold">
            Ver no XML
          </h3>
          {trecho.estado === 'fechado' && (
            <Botao variante="secundario" onClick={() => void verNoXml()}>
              Mostrar o trecho do XML
            </Botao>
          )}
          {trecho.estado === 'lendo' && <p role="status">Relendo o arquivo neste computador…</p>}
          {trecho.estado === 'erro' && (
            <p role="alert">Não consegui reler o arquivo. Ele ainda está no mesmo lugar?</p>
          )}
          {trecho.estado === 'pronto' && <Trecho trecho={trecho.trecho} />}
        </section>

        <footer className="flex flex-wrap gap-3 border-t border-linha pt-4">
          <Botao variante="secundario" onClick={aoAnterior} disabled={!aoAnterior}>
            ← Anterior
          </Botao>
          <Botao variante="secundario" onClick={aoProximo} disabled={!aoProximo}>
            Próximo →
          </Botao>
          <Botao className="ml-auto" onClick={() => dialogo.current?.close()}>
            Fechar
          </Botao>
        </footer>
      </div>
    </dialog>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-secundario">{rotulo}:</dt>
      <dd className="break-all font-mono">{valor}</dd>
    </div>
  );
}

/** O trecho como texto puro (nunca dangerouslySetInnerHTML), com a linha do campo grifada. */
function Trecho({ trecho }: { trecho: TrechoDoXml }) {
  return (
    <div>
      <pre
        className="max-h-80 overflow-auto border border-tinta bg-papel p-3 font-mono text-xs leading-5"
        data-testid="trecho-xml"
        tabIndex={0}
        aria-label="Trecho do XML"
      >
        {trecho.linhas.map((linha, i) => (
          <div
            key={i}
            className={i === trecho.destaque ? 'bg-grifo' : undefined}
            data-destaque={i === trecho.destaque || undefined}
          >
            <span className="mr-3 inline-block w-10 select-none text-right text-secundario">
              {trecho.primeiraLinha + i}
            </span>
            {linha}
          </div>
        ))}
      </pre>
      <p className="mt-1 text-xs text-secundario">
        {trecho.destaque < 0
          ? 'Não deu para localizar o campo; mostrando o começo do evento.'
          : `Linha ${trecho.primeiraLinha + trecho.destaque} de ${trecho.totalDeLinhas}, com uma tag por linha.`}
      </p>
    </div>
  );
}
