// R009 · Incidência incoerente com a natureza. Ficha: docs/arquitetura.md, seção 11.
// A tabela curada vem em ctx.tabelas.naturezaIncidencia (core/leiaute/S-1.3/).
import type { AchadoBruto } from '../../../findings/tipos.ts';
import type { Regra } from '../../tipos.ts';

const CAMPOS = [
  { incidencia: 'inss', campo: 'codIncCP' },
  { incidencia: 'irrf', campo: 'codIncIRRF' },
  { incidencia: 'fgts', campo: 'codIncFGTS' },
] as const;

export const R009: Regra = {
  codigo: 'R009',
  versao: 1,
  titulo: 'Incidência incoerente com a natureza da rubrica',
  explicacao:
    'A incidência informada no S-1010 não é a esperada para a natureza da rubrica. Rubrica com incidência errada gera base de INSS, IRRF ou FGTS errada em todos os trabalhadores que a recebem.',
  sugestao:
    'Revise a incidência da rubrica no S-1010. Se for exceção legítima (decisão judicial, por exemplo), ignore com motivo.',
  severidade: 'alerta',
  eventos: ['S-1010'],
  leiautes: { versao: 'S-1.3', pacoteDe: '2025-11-24' },

  executar({ auditoria, tabelas }) {
    const porNatureza = new Map(tabelas.naturezaIncidencia.map((l) => [l.natureza, l]));
    const achados: AchadoBruto[] = [];
    for (const [chave, rubrica] of [...auditoria.rubricas].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const linha = porNatureza.get(rubrica.natureza);
      if (!linha) continue; // natureza fora da tabela curada: silêncio
      for (const { incidencia, campo } of CAMPOS) {
        const esperado = linha.esperado[incidencia];
        const encontrado = rubrica.incidencias[incidencia];
        if (!esperado || esperado.includes(encontrado)) continue;
        achados.push({
          origem: rubrica.origem,
          campo,
          valores: {
            rubrica: chave,
            natureza: rubrica.natureza,
            encontrado,
            esperado: esperado.join(', '),
            fonte: linha.fonte,
          },
          causa: `rubrica:${chave}`,
          discriminador: `${chave}|${campo}`,
        });
      }
    }
    return achados;
  },
};
