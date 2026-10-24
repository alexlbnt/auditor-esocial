// R002 · Líquido pago diferente do demonstrativo. Ficha: docs/arquitetura.md, seção 11.
import type { AchadoBruto } from '../../../findings/tipos.ts';
import { totais } from '../../../model/totais.ts';
import type { Demonstrativo, FonteDemonstrativo, Pagamento, Pessoa } from '../../../model/tipos.ts';
import type { Regra } from '../../tipos.ts';

/** `tpPgto` do S-1210 -> fonte do demonstrativo (D-16, XSD oficial do evtPgtos). */
const FONTE_POR_TPPGTO: Readonly<Record<string, FonteDemonstrativo>> = {
  '1': 'RGPS',
  '2': 'rescisao',
  '4': 'RPPS',
  '5': 'beneficio',
};

/** Pagamentos do demonstrativo: CPF (a pessoa) + tpPgto + perRef + ideDmDev. */
const pagamentosDe = (pessoa: Pessoa, dm: Demonstrativo): Pagamento[] =>
  pessoa.pagamentos.filter(
    (p) =>
      FONTE_POR_TPPGTO[p.tipoPagamento] === dm.fonte &&
      p.periodoReferencia === dm.periodoReferencia &&
      p.demonstrativoId === dm.id,
  );

export const R002: Regra = {
  codigo: 'R002',
  versao: 1,
  titulo: 'Líquido pago diferente do demonstrativo',
  explicacao:
    'O valor que o S-1210 informa como pago não bate com proventos menos descontos do demonstrativo. O eSocial cruza essas informações, e a diferença costuma aparecer depois como pendência de IRRF ou de contribuição.',
  sugestao:
    'Procure rubrica paga fora da folha, adiantamento não descontado ou pagamento lançado no demonstrativo errado; retifique o evento que estiver errado.',
  severidade: 'erro',
  eventos: ['S-1200', 'S-1202', 'S-1207', 'S-1210', 'S-2299'],
  leiautes: { versao: 'S-1.3', pacoteDe: '2025-11-24' },

  executar({ auditoria, tabelas }) {
    const pares = [...auditoria.pessoas.values()].flatMap((pessoa) =>
      pessoa.demonstrativos.map((dm) => ({ pessoa, dm })),
    );
    const [primeiro] = pares;
    if (!primeiro) return [];

    // Limites do lote: um Info só, em vez de um achado por trabalhador.
    const algumPagamento = [...auditoria.pessoas.values()].some((p) => p.pagamentos.length > 0);
    if (!algumPagamento) {
      return [
        {
          severidade: 'info',
          origem: primeiro.dm.origem,
          valores: { motivo: 'sem-S-1210', demonstrativos: String(pares.length) },
          discriminador: 'sem-S-1210',
        },
      ];
    }
    if (!auditoria.eventos.some((e) => e.origem.tipo === 'S-1010')) {
      return [
        {
          severidade: 'info',
          origem: primeiro.dm.origem,
          valores: { motivo: 'sem-S-1010', demonstrativos: String(pares.length) },
          discriminador: 'sem-S-1010',
        },
      ];
    }

    const achados: AchadoBruto[] = [];
    for (const { pessoa, dm } of pares) {
      const pagos = pagamentosDe(pessoa, dm);
      const [primeiroPago] = pagos;
      if (!primeiroPago) continue; // sem pagamento é a R011
      const t = totais(dm, auditoria.rubricas, tabelas);
      const pago = pagos.reduce((soma, p) => soma + p.liquido, 0);
      const matricula = dm.grupos.find((g) => g.matricula)?.matricula;
      const base = {
        cpf: pessoa.cpf,
        ...(matricula ? { matricula } : {}),
        origem: primeiroPago.origem,
        campo: 'vrLiq',
        discriminador: `${dm.fonte}|${dm.periodoReferencia}|${dm.id}`,
      };
      const naoClassificadas = [...t.rubricasSemCadastro, ...t.rubricasSemTipo].sort();
      if (naoClassificadas.length > 0) {
        // Sem saber se a rubrica é provento ou desconto, não dá para afirmar a diferença.
        const [unica] = naoClassificadas;
        achados.push({
          ...base,
          severidade: 'alerta',
          valores: {
            encontrado: pago,
            pagamentos: String(pagos.length),
            rubricasSemCadastro: naoClassificadas.join(', '),
          },
          ...(naoClassificadas.length === 1 && unica ? { causa: `rubrica:${unica}` } : {}),
        });
      } else if (pago !== t.liquido) {
        achados.push({
          ...base,
          valores: {
            esperado: t.liquido,
            encontrado: pago,
            diferenca: pago - t.liquido,
            proventos: t.proventos,
            descontos: t.descontos,
            pagamentos: String(pagos.length),
          },
        });
      }
    }
    return achados;
  },
};
