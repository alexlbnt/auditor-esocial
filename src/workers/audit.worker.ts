// Roda o core fora da thread da tela (RNF-04). Cancelar = a tela encerra este worker
// (terminate), o que é imediato; a próxima auditoria cria outro.
import * as Comlink from 'comlink';
import { auditar } from '@/core/audit';
import type { ArquivoEntrada } from '@/core/ingest/tipos';
import type { Progresso } from '@/core/progresso';
import type { Validador } from '@/core/xsd/tipos';
import { limitarProgresso } from './limitar-progresso';
import { resumir, type ResumoDaAuditoria } from './resumo';

/** Frequência máxima de progresso para a tela (RNF-04 pede pelo menos 1 por segundo). */
const INTERVALO_PROGRESSO_MS = 150;

let validador: Validador | undefined;
// Sem login, a chave dos achados vale só nesta sessão (ADR 0006).
const segredo = crypto.getRandomValues(new Uint8Array(32));

const api = {
  /**
   * Baixa e compila o pacote XSD mais recente do próprio site. Chamado quando a tela
   * de upload abre, para a auditoria funcionar mesmo offline depois (RNF-16).
   */
  async preparar(baseXsd: string): Promise<{ pacoteXsd: string | undefined }> {
    if (validador) return { pacoteXsd: validador.pacote };
    const indice = (await (await fetch(`${baseXsd}/index.json`)).json()) as { pacotes: string[] };
    // D-09 em aberto: usa o pacote mais recente, como o audit-cli.
    const data = indice.pacotes.at(-1);
    if (!data) return { pacoteXsd: undefined };
    const pacote = (await (await fetch(`${baseXsd}/${data}.json`)).json()) as {
      arquivos: Record<string, string>;
    };
    // Importação sob demanda: a libxml2-wasm usa top-level await para carregar o
    // WebAssembly; importada no topo, ela atrasa o Comlink.expose e a primeira
    // mensagem da tela se perde. Também deixa o wasm fora da carga inicial (RNF-25).
    const { criarValidadorLibxml2 } = await import('@/core/xsd/libxml2');
    const codificador = new TextEncoder();
    validador = criarValidadorLibxml2({
      data,
      arquivos: new Map(
        Object.entries(pacote.arquivos).map(([n, t]) => [n, codificador.encode(t)]),
      ),
    });
    return { pacoteXsd: data };
  },

  async auditar(
    arquivos: File[],
    opcoes: { competencia?: string },
    aoProgredir: (p: Progresso) => void,
  ): Promise<ResumoDaAuditoria> {
    const progresso = limitarProgresso(aoProgredir, INTERVALO_PROGRESSO_MS, () =>
      performance.now(),
    );
    const entradas: ArquivoEntrada[] = [];
    for (const [i, arquivo] of arquivos.entries()) {
      progresso({ etapa: 'lendo', feitos: i, total: arquivos.length });
      entradas.push({ nome: arquivo.name, bytes: new Uint8Array(await arquivo.arrayBuffer()) });
    }
    const resultado = auditar(entradas, {
      ...(validador ? { validador } : {}),
      ...(opcoes.competencia ? { competencia: opcoes.competencia } : {}),
      segredo,
      relogio: () => performance.now(),
      aoProgredir: progresso,
    });
    return resumir(resultado);
  },
};

export type ApiDoWorker = typeof api;

Comlink.expose(api);
