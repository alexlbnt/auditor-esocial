import type { EventoBruto, ItemFora } from '../../ingest/tipos.ts';
import { ErroDeLeitura } from '../xml.ts';
import { parseS1010, type DtoS1010 } from './s1010.ts';
import { parseS1200, type DtoS1200 } from './s1200.ts';

export type * from './s1010.ts';
export type * from './s1200.ts';

/** De onde o evento veio no lote. O XML bruto não segue adiante (RNF-05). */
export interface LocalEvento {
  arquivo: string;
  posicaoNoLote: number;
}

export type EventoLido =
  | { tipo: 'S-1010'; local: LocalEvento; dto: DtoS1010 }
  | { tipo: 'S-1200'; local: LocalEvento; dto: DtoS1200 };

export interface ResultadoLeitura {
  lidos: EventoLido[];
  foraDaAuditoria: ItemFora[];
}

/** XML de cada evento -> DTO. Evento sem leitor ainda vai para "fora da auditoria". */
export function lerEventos(eventos: readonly EventoBruto[]): ResultadoLeitura {
  const lidos: EventoLido[] = [];
  const foraDaAuditoria: ItemFora[] = [];
  for (const evento of eventos) {
    const local = { arquivo: evento.arquivo, posicaoNoLote: evento.posicaoNoLote };
    try {
      switch (evento.tipo) {
        case 'S-1010':
          lidos.push({ tipo: 'S-1010', local, dto: parseS1010(evento.xml) });
          break;
        case 'S-1200':
          lidos.push({ tipo: 'S-1200', local, dto: parseS1200(evento.xml) });
          break;
        default:
          // S-1210 e S-2299 na etapa 1.3b; S-1202, S-1207 e S-1299 no Marco 4.
          foraDaAuditoria.push({
            ...local,
            motivo: 'leitura-nao-implementada',
            detalhe: evento.tipo,
          });
      }
    } catch (erro) {
      if (!(erro instanceof ErroDeLeitura)) throw erro;
      foraDaAuditoria.push({
        ...local,
        motivo: 'leitura-falhou',
        detalhe: `${evento.tipo} ${erro.campo}`,
      });
    }
  }
  return { lidos, foraDaAuditoria };
}
