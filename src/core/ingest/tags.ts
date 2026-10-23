// Leitura superficial de tags, só para achar o envelope e o evento.
// Roda depois do XMLValidator (texto bem-formado); o conteúdo é lido no parse.

export interface Tag {
  prefixo?: string;
  nome: string;
  atributos: ReadonlyMap<string, string>;
  inicio: number;
  /** Posição logo depois do `>` da tag de abertura. */
  fim: number;
}

const TAG = /<(?:([\w.-]+):)?([\w.-]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/y;
const ATRIBUTO = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function lerTag(texto: string, posicao: number): Tag | undefined {
  TAG.lastIndex = posicao;
  const m = TAG.exec(texto);
  if (!m?.[2]) return undefined;
  const atributos = new Map<string, string>();
  for (const a of (m[3] ?? '').matchAll(ATRIBUTO)) {
    if (a[1]) atributos.set(a[1], a[2] ?? a[3] ?? '');
  }
  return {
    ...(m[1] ? { prefixo: m[1] } : {}),
    nome: m[2],
    atributos,
    inicio: posicao,
    fim: TAG.lastIndex,
  };
}

/** Primeiro elemento a partir de `desde`, pulando declaração, comentário, DOCTYPE e fechamento. */
export function proximoElemento(texto: string, desde = 0): Tag | undefined {
  let i = texto.indexOf('<', desde);
  while (i !== -1) {
    const seguinte = texto[i + 1];
    if (texto.startsWith('<!--', i)) {
      const fim = texto.indexOf('-->', i + 4);
      if (fim === -1) return undefined;
      i = texto.indexOf('<', fim + 3);
    } else if (seguinte === '?' || seguinte === '!' || seguinte === '/') {
      i = texto.indexOf('<', i + 1);
    } else {
      return lerTag(texto, i);
    }
  }
  return undefined;
}

/** Namespace do elemento, declarado nele mesmo (`xmlns` ou `xmlns:<prefixo>`). */
export function namespaceDe(tag: Tag): string | undefined {
  return tag.atributos.get(tag.prefixo ? `xmlns:${tag.prefixo}` : 'xmlns');
}

/** Conteúdo de cada elemento `nome` (sem aninhamento do mesmo nome), em ordem. */
export function conteudosDe(texto: string, nome: string): { abertura: Tag; conteudo: string }[] {
  const abertura = new RegExp(`<(?:[\\w.-]+:)?${nome}\\b`, 'g');
  const fechamento = new RegExp(`</(?:[\\w.-]+:)?${nome}\\s*>`, 'g');
  const saida: { abertura: Tag; conteudo: string }[] = [];
  for (const m of texto.matchAll(abertura)) {
    const tag = lerTag(texto, m.index);
    if (!tag || tag.nome !== nome) continue;
    fechamento.lastIndex = tag.fim;
    const fim = fechamento.exec(texto);
    if (!fim) continue;
    saida.push({ abertura: tag, conteudo: texto.slice(tag.fim, fim.index).trim() });
  }
  return saida;
}
