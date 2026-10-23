// Lê pacotes XSD do disco para o formato do core (só Node: CLI e testes).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { PacoteXsd } from '../../src/core/xsd/tipos.ts';

export const RAIZ_PACOTES = 'schemas/xsd/S-1.3';

/** Datas dos pacotes (`AAAA-MM-DD`) em ordem crescente. */
export function listarPacotes(raiz = RAIZ_PACOTES): string[] {
  if (!existsSync(raiz)) return [];
  return readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function listarXsd(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return listarXsd(caminho);
    return item.isFile() && item.name.toLowerCase().endsWith('.xsd') ? [caminho] : [];
  });
}

export function carregarPacote(data: string, raiz = RAIZ_PACOTES): PacoteXsd {
  const pasta = join(raiz, data);
  const arquivos = new Map<string, Uint8Array>();
  for (const caminho of listarXsd(pasta).sort()) {
    arquivos.set(
      relative(pasta, caminho).split(sep).join('/'),
      new Uint8Array(readFileSync(caminho)),
    );
  }
  return { data, arquivos };
}
