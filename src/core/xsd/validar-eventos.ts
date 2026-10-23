import type { EventoBruto, ItemFora } from '../ingest/tipos.ts';
import type { ErroXsd, Validador } from './tipos.ts';

/** Evento reprovado no XSD: vira o achado R001 e não entra no modelo. */
export interface EventoReprovado {
  evento: EventoBruto;
  /** Até 5 mensagens, com linha e coluna. */
  erros: ErroXsd[];
  /** Total de erros encontrados (pode passar de 5). */
  total: number;
}

export interface ResultadoValidacao {
  pacoteXsd: string;
  aprovados: EventoBruto[];
  reprovados: EventoReprovado[];
  foraDaAuditoria: ItemFora[];
  /** Eventos aceitos sem assinatura digital (D-08): aviso único no cabeçalho. */
  semAssinatura: number;
}

/**
 * Etapa R001: valida cada evento contra o pacote, antes do parse. A ordem de
 * entrada é preservada. Sem esquema para o evento, ele não é auditado e aparece
 * em "fora da auditoria"; nunca passa como aprovado.
 */
export function validarEventos(
  eventos: readonly EventoBruto[],
  validador: Validador,
): ResultadoValidacao {
  const resultado: ResultadoValidacao = {
    pacoteXsd: validador.pacote,
    aprovados: [],
    reprovados: [],
    foraDaAuditoria: [],
    semAssinatura: 0,
  };
  for (const evento of eventos) {
    const r = validador.validar(evento.xml, evento.namespace);
    const onde = { arquivo: evento.arquivo, posicaoNoLote: evento.posicaoNoLote };
    switch (r.status) {
      case 'valido':
        resultado.aprovados.push(evento);
        break;
      case 'invalido':
        resultado.reprovados.push({ evento, erros: r.erros, total: r.total });
        break;
      case 'sem-esquema':
        resultado.foraDaAuditoria.push({
          ...onde,
          motivo: 'xsd-indisponivel',
          detalhe: `${evento.tipo} no pacote ${validador.pacote}`,
        });
        break;
      case 'malformado': {
        const [primeiro] = r.erros;
        resultado.foraDaAuditoria.push({
          ...onde,
          motivo: 'xml-malformado',
          detalhe: primeiro ? `linha ${primeiro.linha}, coluna ${primeiro.coluna}` : '',
        });
        break;
      }
    }
    if (r.status === 'valido' || r.status === 'invalido') {
      if (r.assinaturaAusente) resultado.semAssinatura += 1;
    }
  }
  return resultado;
}
