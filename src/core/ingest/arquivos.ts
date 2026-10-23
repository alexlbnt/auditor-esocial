import { unzipSync, type UnzipFileInfo } from 'fflate';
import type { Limites } from './limites.ts';
import type { ArquivoEntrada, ItemFora, Recusa } from './tipos.ts';

export interface ArquivoDoLote {
  caminho: string;
  bytes: Uint8Array;
}

export type ResultadoExpansao =
  | { recusa: Recusa }
  | { recusa?: undefined; arquivos: ArquivoDoLote[]; foraDaAuditoria: ItemFora[] };

/** Zip começa com a assinatura local `PK\x03\x04` (ou `PK\x05\x06`, se vazio). */
export function ehZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

export function ehXml(caminho: string): boolean {
  return caminho.toLowerCase().endsWith('.xml');
}

const ordenar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

class LoteRecusado extends Error {
  readonly recusa: Recusa;
  constructor(recusa: Recusa) {
    super(recusa.limite);
    this.recusa = recusa;
  }
}

/**
 * Abre os zips (um nível de zip dentro de zip) e aplica os limites do RNF-06
 * antes de descompactar, pelos tamanhos declarados no próprio zip.
 * Saída ordenada por caminho: mesma entrada, mesma ordem.
 */
export function expandirArquivos(
  entradas: readonly ArquivoEntrada[],
  limites: Readonly<Limites>,
): ResultadoExpansao {
  const arquivos: ArquivoDoLote[] = [];
  const foraDaAuditoria: ItemFora[] = [];
  let quantidade = 0;
  let bytesTotais = 0;

  const contar = (caminho: string, tamanho: number) => {
    quantidade += 1;
    bytesTotais += tamanho;
    if (quantidade > limites.arquivos) {
      throw new LoteRecusado({
        limite: 'quantidade-de-arquivos',
        valor: quantidade,
        maximo: limites.arquivos,
      });
    }
    if (bytesTotais > limites.bytesDescompactados) {
      throw new LoteRecusado({
        limite: 'tamanho-descompactado',
        valor: bytesTotais,
        maximo: limites.bytesDescompactados,
      });
    }
    if (ehXml(caminho) && tamanho > limites.bytesPorXml) {
      throw new LoteRecusado({
        limite: 'tamanho-do-xml',
        arquivo: caminho,
        valor: tamanho,
        maximo: limites.bytesPorXml,
      });
    }
  };

  const abrirZip = (caminhoZip: string, bytes: Uint8Array, nivel: number) => {
    // 1ª passada: só lê o diretório do zip, sem descompactar nada.
    const declarados: UnzipFileInfo[] = [];
    let conteudo: Record<string, Uint8Array>;
    try {
      unzipSync(bytes, {
        filter: (info) => {
          declarados.push(info);
          return false;
        },
      });
      for (const info of declarados) {
        if (info.name.endsWith('/')) continue;
        const caminho = `${caminhoZip}/${info.name}`;
        const taxa = info.originalSize / Math.max(info.size, 1);
        if (taxa > limites.taxaCompressao) {
          throw new LoteRecusado({
            limite: 'taxa-de-compressao',
            arquivo: caminho,
            valor: Math.round(taxa),
            maximo: limites.taxaCompressao,
          });
        }
      }
      // 2ª passada: descompacta só arquivos (pastas não têm conteúdo).
      conteudo = unzipSync(bytes, { filter: (info) => !info.name.endsWith('/') });
    } catch (erro) {
      if (erro instanceof LoteRecusado) throw erro;
      foraDaAuditoria.push({ arquivo: caminhoZip, motivo: 'zip-corrompido' });
      return;
    }
    for (const nome of Object.keys(conteudo).sort(ordenar)) {
      const dados = conteudo[nome];
      if (!dados) continue;
      adicionar(`${caminhoZip}/${nome}`, dados, nivel);
    }
  };

  const adicionar = (caminho: string, bytes: Uint8Array, nivel: number) => {
    if (ehZip(bytes)) {
      if (nivel >= 2) {
        foraDaAuditoria.push({ arquivo: caminho, motivo: 'zip-aninhado' });
        return;
      }
      abrirZip(caminho, bytes, nivel + 1);
      return;
    }
    contar(caminho, bytes.length);
    arquivos.push({ caminho, bytes });
  };

  try {
    const ordenadas = [...entradas].sort((a, b) => ordenar(a.nome, b.nome));
    for (const entrada of ordenadas) adicionar(entrada.nome, entrada.bytes, 0);
  } catch (erro) {
    if (erro instanceof LoteRecusado) return { recusa: erro.recusa };
    throw erro;
  }
  return { arquivos, foraDaAuditoria };
}
