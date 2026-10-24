// R001 · XML fora do esquema. A validação roda antes do parse (core/xsd); esta regra
// só transforma cada evento reprovado num achado. Ficha: docs/arquitetura.md, seção 11.
import type { AchadoBruto } from '../../../findings/tipos.ts';
import type { Regra } from '../../tipos.ts';

export const R001: Regra = {
  codigo: 'R001',
  versao: 1,
  titulo: 'XML fora do esquema do eSocial',
  explicacao:
    'O arquivo não segue a estrutura oficial do leiaute. O eSocial rejeitaria o evento na transmissão, e ele ficou fora do resto desta auditoria.',
  sugestao:
    'Corrija o dado na folha e gere o XML de novo. Não edite o XML na mão: a próxima geração desfaz a correção.',
  severidade: 'erro',
  eventos: ['S-1010', 'S-1200', 'S-1202', 'S-1207', 'S-1210', 'S-1299', 'S-2299'],
  leiautes: { versao: 'S-1.3', pacoteDe: '2025-11-24' },
  requerXsd: true,
  // Precisa rodar quando todos os eventos foram reprovados (7.3: "ver os erros R001").
  independeDoModelo: true,

  executar({ xsd }) {
    return xsd.reprovados.map(({ evento, erros, total }): AchadoBruto => {
      const valores: Record<string, string | number> = { total: String(total) };
      erros.forEach((e, i) => {
        valores[`erro${i + 1}`] = `linha ${e.linha}, coluna ${e.coluna}: ${e.mensagem}`;
      });
      return {
        origem: {
          arquivo: evento.arquivo,
          posicaoNoLote: evento.posicaoNoLote,
          eventoId: evento.id,
          tipo: evento.tipo,
        },
        valores,
        // O Id é o que identifica o mesmo evento entre auditorias.
        discriminador: evento.id,
      };
    });
  },
};
