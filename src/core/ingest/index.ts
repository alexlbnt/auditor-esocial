import { XMLValidator } from 'fast-xml-parser';
import {
  EVENTO_EXCLUSAO,
  EVENTOS_DO_MVP,
  NS_LOTE_ENVIO,
  VERSOES_SUPORTADAS,
  lerNamespaceEvento,
} from '../leiaute/eventos.ts';
import { ehXml, expandirArquivos } from './arquivos.ts';
import { LIMITES_RNF06, type Limites } from './limites.ts';
import { conteudosDe, namespaceDe, proximoElemento, type Tag } from './tags.ts';
import { decodificar } from './texto.ts';
import type { ArquivoEntrada, EventoBruto, ItemFora, ResultadoIngest } from './tipos.ts';

export type * from './tipos.ts';
export { LIMITES_RNF06, type Limites } from './limites.ts';

/** Só código e posição: a mensagem da biblioteca pode citar conteúdo do XML. */
function malformado(texto: string): string | undefined {
  const r = XMLValidator.validate(texto);
  return r === true ? undefined : `${r.err.code} (linha ${r.err.line}, coluna ${r.err.col})`;
}

/** Acrescenta à raiz do trecho os `xmlns:<prefixo>` dos ancestrais que ela não declara. */
function herdarPrefixos(trecho: string, ancestrais: readonly Tag[]): string {
  const raiz = proximoElemento(trecho);
  if (!raiz) return trecho;
  const herdados = new Map<string, string>();
  for (const tag of ancestrais) {
    for (const [nome, valor] of tag.atributos) {
      if (nome.startsWith('xmlns:') && !raiz.atributos.has(nome)) herdados.set(nome, valor);
    }
  }
  if (herdados.size === 0) return trecho;
  const declaracoes = [...herdados].map(([nome, valor]) => ` ${nome}="${valor}"`).join('');
  const aposNome =
    raiz.inicio + 1 + (raiz.prefixo ? raiz.prefixo.length + 1 : 0) + raiz.nome.length;
  return trecho.slice(0, aposNome) + declaracoes + trecho.slice(aposNome);
}

type Analise =
  | { evento: Omit<EventoBruto, 'arquivo' | 'posicaoNoLote'> }
  | { fora: Omit<ItemFora, 'arquivo' | 'posicaoNoLote'> };

/** Evento solto: `<eSocial xmlns=".../evt/<evento>/<versão>"><evtX Id="...">`. */
function analisarEvento(xml: string): Analise {
  const raiz = proximoElemento(xml);
  const ns = raiz ? namespaceDe(raiz) : undefined;
  const lido = ns ? lerNamespaceEvento(ns) : undefined;
  if (!raiz || !ns || !lido) {
    return { fora: { motivo: 'xml-nao-reconhecido', detalhe: ns ?? raiz?.nome ?? '' } };
  }
  if (lido.evento === EVENTO_EXCLUSAO) {
    return { fora: { motivo: 'exclusao-nao-considerada', detalhe: lido.evento } };
  }
  const tipo = EVENTOS_DO_MVP[lido.evento];
  if (!tipo) return { fora: { motivo: 'evento-fora-do-mvp', detalhe: lido.evento } };
  const leiaute = VERSOES_SUPORTADAS[lido.versao];
  if (!leiaute) {
    return { fora: { motivo: 'leiaute-nao-suportado', detalhe: `${tipo} ${lido.versao}` } };
  }
  const id = proximoElemento(xml, raiz.fim)?.atributos.get('Id') ?? '';
  return { evento: { tipo, leiaute, namespace: ns, id, xml } };
}

/**
 * Primeira etapa da auditoria: abre zips, lê o envelope do lote ou o evento
 * solto e identifica cada evento pelo namespace. O que não serve vai para
 * `foraDaAuditoria`; lote acima do RNF-06 é recusado antes de tudo.
 */
export function lerLote(
  entradas: readonly ArquivoEntrada[],
  limites: Readonly<Limites> = LIMITES_RNF06,
): ResultadoIngest {
  const expansao = expandirArquivos(entradas, limites);
  if (expansao.recusa) return { recusa: expansao.recusa };

  const eventos: EventoBruto[] = [];
  const foraDaAuditoria: ItemFora[] = [...expansao.foraDaAuditoria];
  const registrar = (arquivo: string, posicaoNoLote: number, analise: Analise) => {
    if ('evento' in analise) eventos.push({ arquivo, posicaoNoLote, ...analise.evento });
    else foraDaAuditoria.push({ arquivo, posicaoNoLote, ...analise.fora });
  };

  for (const { caminho, bytes } of expansao.arquivos) {
    if (!ehXml(caminho)) {
      foraDaAuditoria.push({ arquivo: caminho, motivo: 'nao-xml' });
      continue;
    }
    const texto = decodificar(bytes);
    if (texto === undefined) {
      foraDaAuditoria.push({ arquivo: caminho, motivo: 'encoding-nao-suportado' });
      continue;
    }
    const erro = malformado(texto);
    if (erro) {
      foraDaAuditoria.push({ arquivo: caminho, motivo: 'xml-malformado', detalhe: erro });
      continue;
    }
    const raiz = proximoElemento(texto);
    if (raiz && namespaceDe(raiz) === NS_LOTE_ENVIO) {
      const blocos = conteudosDe(texto, 'evento');
      if (blocos.length === 0) {
        foraDaAuditoria.push({
          arquivo: caminho,
          motivo: 'xml-nao-reconhecido',
          detalhe: 'lote sem eventos',
        });
      }
      blocos.forEach(({ abertura, conteudo: trecho }, i) => {
        // O trecho do evento é lido sozinho (XSD e parse): leva junto os prefixos
        // declarados no envelope, como o xmlns:xsi do lote real.
        const conteudo = herdarPrefixos(trecho, [raiz, abertura]);
        const erroTrecho = malformado(conteudo);
        if (erroTrecho) {
          foraDaAuditoria.push({
            arquivo: caminho,
            posicaoNoLote: i + 1,
            motivo: 'xml-malformado',
            detalhe: erroTrecho,
          });
        } else {
          registrar(caminho, i + 1, analisarEvento(conteudo));
        }
      });
    } else {
      registrar(caminho, 1, analisarEvento(texto));
    }
  }
  return { eventos, foraDaAuditoria };
}
