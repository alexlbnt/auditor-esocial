// "Ver no XML" (HU-03): o trecho do evento em volta do campo do achado. Só texto: a
// tela mostra como texto, nunca como HTML.
import type { Achado } from '@/core/findings/tipos';

export interface TrechoDoXml {
  /** Linhas do trecho (o XML com uma tag por linha, só para leitura). */
  linhas: string[];
  /** Número (1 em diante) da primeira linha do trecho no evento inteiro. */
  primeiraLinha: number;
  /** Índice, dentro de `linhas`, da linha destacada; -1 se não deu para localizar. */
  destaque: number;
  totalDeLinhas: number;
}

/** Uma tag por linha: os lotes reais costumam vir numa linha só. */
export function umaTagPorLinha(xml: string): string[] {
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((l) => l.trimEnd());
}

const abre = (nome: string) => new RegExp(`<(?:[\\w.-]+:)?${nome}[\\s>/]`);

/**
 * Linha do campo do achado. Usa o último trecho com índice do caminho que existe no
 * XML (ex.: `infoPgto[1]`) para achar a ocorrência certa e, dali, o campo. Na R001,
 * o campo vem da primeira mensagem do XSD ("Element '...cpfTrab'").
 */
export function linhaDoAchado(linhas: readonly string[], achado: Achado): number {
  let campo = achado.campo;
  if (achado.regra === 'R001') {
    const mensagem = String(achado.valores?.erro1 ?? '');
    campo = /Element '(?:\{[^}]*\})?([\w.-]+)'/.exec(mensagem)?.[1];
  }
  let inicio = 0;
  const indexados = [...(achado.caminho ?? '').matchAll(/([\w.-]+)\[(\d+)\]/g)].reverse();
  for (const [, nome = '', n = '1'] of indexados) {
    const tag = abre(nome);
    const ocorrencias = linhas.flatMap((l, i) => (tag.test(l) ? [i] : []));
    const alvo = ocorrencias[parseInt(n, 10) - 1];
    if (alvo !== undefined) {
      inicio = alvo;
      break;
    }
  }
  if (!campo) return -1;
  const tag = abre(campo);
  const depois = linhas.findIndex((l, i) => i >= inicio && tag.test(l));
  return depois >= 0 ? depois : linhas.findIndex((l) => tag.test(l));
}

/** Recuo de 2 espaços por nível, só para ler (a busca do campo usa o texto sem recuo). */
export function comRecuo(linhas: readonly string[]): string[] {
  let nivel = 0;
  return linhas.map((linha) => {
    const fecha = linha.startsWith('</');
    if (fecha) nivel = Math.max(0, nivel - 1);
    const saida = `${'  '.repeat(nivel)}${linha}`;
    const abreSemFechar =
      !fecha &&
      linha.startsWith('<') &&
      !/^<[?!]/.test(linha) &&
      !linha.endsWith('/>') &&
      !linha.includes('</');
    if (abreSemFechar) nivel += 1;
    return saida;
  });
}

/** Recorte de até `contexto` linhas antes e depois do destaque. */
export function trechoDoEvento(xmlDoEvento: string, achado: Achado, contexto = 10): TrechoDoXml {
  const linhas = umaTagPorLinha(xmlDoEvento);
  const alvo = linhaDoAchado(linhas, achado);
  const inicio = alvo < 0 ? 0 : Math.max(0, alvo - contexto);
  const fim =
    alvo < 0
      ? Math.min(linhas.length, contexto * 2 + 1)
      : Math.min(linhas.length, alvo + contexto + 1);
  return {
    linhas: comRecuo(linhas).slice(inicio, fim),
    primeiraLinha: inicio + 1,
    destaque: alvo < 0 ? -1 : alvo - inicio,
    totalDeLinhas: linhas.length,
  };
}
