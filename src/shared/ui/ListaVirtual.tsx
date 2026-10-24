'use client';

import { useState, type ReactNode } from 'react';

interface Props<T> {
  itens: readonly T[];
  /** Altura fixa de cada linha, em px. */
  alturaLinha: number;
  /** Altura visível da lista, em px. */
  altura: number;
  chave: (item: T) => string;
  renderizar: (item: T) => ReactNode;
  rotulo: string;
}

/** Linhas renderizadas além da área visível, para a rolagem não piscar. */
const EXTRA = 8;

/**
 * Lista virtualizada simples (sem dependência): só as linhas visíveis vão para o
 * DOM, então 10.000 achados rolam sem travar (RNF-07). Linhas de altura fixa.
 */
export function ListaVirtual<T>({
  itens,
  alturaLinha,
  altura,
  chave,
  renderizar,
  rotulo,
}: Props<T>) {
  const [topo, setTopo] = useState(0);
  const inicio = Math.max(0, Math.floor(topo / alturaLinha) - EXTRA);
  const fim = Math.min(itens.length, Math.ceil((topo + altura) / alturaLinha) + EXTRA);
  return (
    <div
      role="list"
      aria-label={rotulo}
      tabIndex={0}
      data-testid="lista-virtual"
      className="overflow-y-auto border border-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tinta"
      style={{ height: Math.min(altura, itens.length * alturaLinha + 2) }}
      onScroll={(e) => setTopo(e.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: itens.length * alturaLinha }}>
        {itens.slice(inicio, fim).map((item, k) => {
          const i = inicio + k;
          return (
            <div
              key={chave(item)}
              role="listitem"
              aria-setsize={itens.length}
              aria-posinset={i + 1}
              className="absolute inset-x-0"
              style={{ top: i * alturaLinha, height: alturaLinha }}
            >
              {renderizar(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
