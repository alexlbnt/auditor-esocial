// O que o worker devolve para a tela: o necessário para o relatório, sem o texto dos
// XMLs (RNF-05: o XML bruto não fica em memória; "ver no XML" relê o arquivo).
import type { ResultadoAuditoria, TemposPorEtapa } from '@/core/audit';
import type { Achado } from '@/core/findings/tipos';
import type { ItemFora, Recusa } from '@/core/ingest/tipos';
import type { TipoEvento } from '@/core/leiaute/eventos';
import type { RegraNaoExecutada } from '@/core/rules/tipos';

export interface TrabalhadorNaTela {
  cpf: string;
  matriculas: string[];
}

export type ResumoDaAuditoria =
  | { tipo: 'recusado'; recusa: Recusa }
  | {
      tipo: 'concluido';
      xsd: 'validado' | 'nao-executado';
      pacoteXsd?: string;
      modelo:
        | { tipo: 'pronta'; competencia: string; apuracao: 'mensal' | 'anual'; empregador: string }
        | { tipo: 'escolher-competencia'; competencias: string[] }
        | { tipo: 'varios-empregadores'; raizes: string[] }
        | { tipo: 'sem-remuneracao' };
      eventosPorTipo: Partial<Record<TipoEvento, number>>;
      reprovadosNoXsd: number;
      semAssinatura: number;
      trabalhadores: TrabalhadorNaTela[];
      achados: Achado[];
      foraDaAuditoria: ItemFora[];
      regrasNaoExecutadas: RegraNaoExecutada[];
      regrasExecutadas: { codigo: string; versao: number }[];
      tempos?: TemposPorEtapa;
    };

export function resumir(r: ResultadoAuditoria): ResumoDaAuditoria {
  if (r.recusa) return { tipo: 'recusado', recusa: r.recusa };
  const eventosPorTipo: Partial<Record<TipoEvento, number>> = {};
  for (const e of r.eventos) eventosPorTipo[e.tipo] = (eventosPorTipo[e.tipo] ?? 0) + 1;
  const m = r.modelo;
  const modelo: Extract<ResumoDaAuditoria, { tipo: 'concluido' }>['modelo'] =
    m.tipo === 'pronta'
      ? {
          tipo: 'pronta',
          competencia: m.auditoria.competencia,
          apuracao: m.auditoria.apuracao,
          empregador: m.auditoria.empregador.raiz,
        }
      : m;
  const trabalhadores =
    m.tipo === 'pronta'
      ? [...m.auditoria.pessoas.values()].map((p) => ({
          cpf: p.cpf,
          matriculas: [
            ...new Set(
              p.demonstrativos
                .flatMap((d) => d.grupos.map((g) => g.matricula ?? ''))
                .filter(Boolean),
            ),
          ].sort(),
        }))
      : [];
  return {
    tipo: 'concluido',
    xsd: r.xsd,
    ...(r.pacoteXsd ? { pacoteXsd: r.pacoteXsd } : {}),
    modelo,
    eventosPorTipo,
    reprovadosNoXsd: r.reprovados.length,
    semAssinatura: r.semAssinatura,
    trabalhadores,
    achados: r.motor?.achados ?? [],
    foraDaAuditoria: r.foraDaAuditoria,
    regrasNaoExecutadas: r.motor?.naoExecutadas ?? [],
    regrasExecutadas: r.motor?.regrasExecutadas ?? [],
    ...(r.tempos ? { tempos: r.tempos } : {}),
  };
}
