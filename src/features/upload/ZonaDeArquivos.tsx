'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Botao } from '@/shared/ui/Botao';

interface Props {
  habilitada: boolean;
  aoEscolher: (arquivos: File[]) => void;
}

/**
 * Soltar ou escolher .zip/.xml (vários de uma vez). Funciona por teclado: o botão
 * abre o seletor de arquivos; a área de soltar é só um atalho para o mouse.
 */
export function ZonaDeArquivos({ habilitada, aoEscolher }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (!habilitada) return;
    const arquivos = [...e.dataTransfer.files];
    if (arquivos.length) aoEscolher(arquivos);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (habilitada) setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={soltar}
      data-testid="zona-de-arquivos"
      className={`flex flex-col items-center gap-4 rounded-sm border-2 border-dashed px-6 py-12 text-center transition-colors ${
        arrastando ? 'border-tinta bg-grifo/40' : 'border-secundario'
      }`}
    >
      <p className="text-lg font-semibold">Solte aqui o .zip ou os XMLs da competência</p>
      <p className="text-secundario">
        S-1010, S-1200, S-1210, S-2299 e os demais eventos do leiaute S-1.3.
      </p>
      <input
        ref={entrada}
        type="file"
        multiple
        accept=".zip,.xml,application/zip,text/xml,application/xml"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="entrada-de-arquivos"
        onChange={(e) => {
          const arquivos = [...(e.target.files ?? [])];
          e.target.value = '';
          if (arquivos.length) aoEscolher(arquivos);
        }}
      />
      <Botao disabled={!habilitada} onClick={() => entrada.current?.click()}>
        Escolher arquivos
      </Botao>
    </div>
  );
}
