// R003 · Remuneração depois do desligamento. Ficha: docs/arquitetura.md, seção 11.
import type { AchadoBruto } from '../../../findings/tipos.ts';
import type { Regra } from '../../tipos.ts';

/** Primeiro dia da competência: `AAAA-MM-01` (mensal) ou `AAAA-01-01` (13º). */
const primeiroDia = (competencia: string) =>
  competencia.length === 4 ? `${competencia}-01-01` : `${competencia}-01`;

export const R003: Regra = {
  codigo: 'R003',
  versao: 1,
  titulo: 'Remuneração depois do desligamento',
  explicacao:
    'Há folha da competência para uma matrícula que o S-2299 do lote já desligou antes do início do mês. O eSocial não aceita remuneração mensal de vínculo encerrado.',
  sugestao:
    'Se a verba é rescisória, ela vai no S-2299. Se a folha foi gerada por engano, exclua ou retifique o S-1200.',
  severidade: 'erro',
  eventos: ['S-1200', 'S-2299'],
  leiautes: { versao: 'S-1.3', pacoteDe: '2025-11-24' },

  executar({ auditoria }) {
    const inicio = primeiroDia(auditoria.competencia);
    const achados: AchadoBruto[] = [];
    for (const pessoa of auditoria.pessoas.values()) {
      for (const deslig of pessoa.desligamentos) {
        if (!deslig.matricula || deslig.data >= inicio) continue;
        for (const dm of pessoa.demonstrativos) {
          if (dm.fonte !== 'RGPS') continue;
          // Só infoPerApur: diferença de período anterior (retroativo) é legítima.
          const grupos = dm.grupos.filter(
            (g) => !g.periodoAnterior && g.matricula === deslig.matricula,
          );
          if (grupos.length === 0) continue;
          achados.push({
            cpf: pessoa.cpf,
            matricula: deslig.matricula,
            origem: dm.origem,
            campo: 'infoPerApur',
            valores: { dataDesligamento: deslig.data, competencia: auditoria.competencia },
            discriminador: `${dm.id}|${deslig.matricula}`,
          });
        }
      }
    }
    return achados;
  },
};
