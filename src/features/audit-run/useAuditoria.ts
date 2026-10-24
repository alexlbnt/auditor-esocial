'use client';

import * as Comlink from 'comlink';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Progresso } from '@/core/progresso';
import type { ApiDoWorker } from '@/workers/audit.worker';
import type { ResumoDaAuditoria } from '@/workers/resumo';

export type EstadoDaAuditoria =
  | { fase: 'preparando' }
  | { fase: 'pronta-para-receber'; pacoteXsd: string | undefined }
  | { fase: 'auditando'; progresso: Progresso | undefined; arquivos: number }
  | { fase: 'concluida'; resumo: ResumoDaAuditoria }
  | { fase: 'erro'; codigo: 'xsd-indisponivel' | 'falha-na-auditoria' };

/** Mostrado na tela de upload depois de voltar a ela. */
export type Aviso = 'cancelada' | undefined;

const BASE_XSD = '/xsd/S-1.3';

interface WorkerAtivo {
  worker: Worker;
  api: Comlink.Remote<ApiDoWorker>;
  pronto: Promise<{ pacoteXsd: string | undefined }>;
}

function criarWorker(): WorkerAtivo {
  const worker = new Worker(new URL('../../workers/audit.worker.ts', import.meta.url), {
    type: 'module',
    name: 'auditoria',
  });
  const api = Comlink.wrap<ApiDoWorker>(worker);
  return { worker, api, pronto: api.preparar(BASE_XSD) };
}

/**
 * Ciclo de vida do worker: prepara o XSD ao abrir a tela, audita e cancela. Cancelar
 * encerra o worker (imediato, RNF-04) e cria outro, já preparando o XSD.
 */
export function useAuditoria() {
  const [estado, setEstado] = useState<EstadoDaAuditoria>({ fase: 'preparando' });
  const [aviso, setAviso] = useState<Aviso>(undefined);
  const atual = useRef<WorkerAtivo | undefined>(undefined);
  // Cada worker tem uma geração: respostas de um worker já encerrado são ignoradas.
  const geracao = useRef(0);

  /** Cria o worker e começa a preparar o XSD. Não mexe no estado de forma síncrona. */
  const ligarWorker = useCallback(() => {
    atual.current?.worker.terminate();
    const novo = criarWorker();
    atual.current = novo;
    const minha = ++geracao.current;
    novo.pronto
      .then(({ pacoteXsd }) => {
        if (geracao.current === minha) setEstado({ fase: 'pronta-para-receber', pacoteXsd });
      })
      .catch(() => {
        // Erro sem dado pessoal: só o código.
        if (geracao.current === minha) setEstado({ fase: 'erro', codigo: 'xsd-indisponivel' });
      });
  }, []);

  useEffect(() => {
    ligarWorker();
    return () => atual.current?.worker.terminate();
  }, [ligarWorker]);

  /** Encerra o worker atual (imediato) e volta a preparar um novo. */
  const reiniciar = useCallback(() => {
    setEstado({ fase: 'preparando' });
    ligarWorker();
  }, [ligarWorker]);

  const auditar = useCallback(async (arquivos: File[], competencia?: string) => {
    const corrente = atual.current;
    if (!corrente || arquivos.length === 0) return;
    const minha = geracao.current;
    const aindaEsta = () => geracao.current === minha;
    setAviso(undefined);
    setEstado({ fase: 'auditando', progresso: undefined, arquivos: arquivos.length });
    try {
      // Sem isto, arquivos soltos durante a preparação seriam auditados sem o XSD.
      await corrente.pronto;
      const resumo = await corrente.api.auditar(
        arquivos,
        competencia ? { competencia } : {},
        Comlink.proxy((progresso: Progresso) => {
          if (aindaEsta()) setEstado({ fase: 'auditando', progresso, arquivos: arquivos.length });
        }),
      );
      if (aindaEsta()) setEstado({ fase: 'concluida', resumo });
    } catch {
      if (aindaEsta()) setEstado({ fase: 'erro', codigo: 'falha-na-auditoria' });
    }
  }, []);

  /** HU-01: para tudo em até 1 s e volta à tela inicial. */
  const cancelar = useCallback(() => {
    reiniciar();
    setAviso('cancelada');
  }, [reiniciar]);

  const recomecar = useCallback(() => {
    setAviso(undefined);
    reiniciar();
  }, [reiniciar]);

  return { estado, aviso, auditar, cancelar, recomecar };
}
