import { XMLParser } from 'fast-xml-parser';

/** Nó lido pelo fast-xml-parser: texto, atributos (`@_`) e filhos. */
export type No = { readonly [chave: string]: unknown };

/** Campo obrigatório ausente ou malformado. Só acontece quando o XSD não rodou. */
export class ErroDeLeitura extends Error {
  readonly campo: string;
  constructor(campo: string) {
    super(`Campo ausente ou inválido: ${campo}`);
    this.campo = campo;
  }
}

/**
 * Leitor do XML de um evento. Valores sempre como texto (CPF com zero à
 * esquerda, decimais exatos); `repetiveis` vem do XSD de cada evento.
 */
export function criarLeitor(repetiveis: ReadonlySet<string>): (xml: string) => No {
  const parser = new XMLParser({
    parseTagValue: false,
    parseAttributeValue: false,
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    trimValues: true,
    // O isArray só olha o nome da tag: sem montar o caminho em texto (mais rápido).
    jPath: false,
    isArray: (nome, _caminho, _folha, atributo) => !atributo && repetiveis.has(nome),
  });
  return (xml) => parser.parse(xml) as No;
}

function ehNo(valor: unknown): valor is No {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Filho único; `caminho` só compõe a mensagem de erro. */
export function no(pai: No, nome: string, caminho = nome): No {
  const valor = pai[nome];
  if (valor === '') return {}; // elemento vazio: o erro aponta o filho que falta
  if (!ehNo(valor)) throw new ErroDeLeitura(caminho);
  return valor;
}

export function noOpcional(pai: No, nome: string): No | undefined {
  const valor = pai[nome];
  return ehNo(valor) ? valor : undefined;
}

/** Filhos repetíveis (sempre lista; vazia se ausentes). */
export function lista(pai: No, nome: string): No[] {
  const valor = pai[nome];
  if (valor === undefined) return [];
  return (Array.isArray(valor) ? valor : [valor]).filter(ehNo);
}

export function textoOpcional(pai: No, nome: string): string | undefined {
  const valor = pai[nome];
  if (typeof valor === 'string') return valor;
  if (ehNo(valor) && typeof valor['#text'] === 'string') return valor['#text'];
  return undefined;
}

export function texto(pai: No, nome: string, caminho = nome): string {
  const valor = textoOpcional(pai, nome);
  if (valor === undefined || valor === '') throw new ErroDeLeitura(caminho);
  return valor;
}
