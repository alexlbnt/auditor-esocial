import { chaveDoAchado } from '../findings/chave.ts';
import { GRAVIDADE, type Achado, type AchadoBruto } from '../findings/tipos.ts';
import type { Regra, ContextoRegra, RegraNaoExecutada, ResultadoMotor } from './tipos.ts';

export interface OpcoesMotor {
  /** Segredo da conta (ou da sessão, sem login) para a chave HMAC. */
  segredo: Uint8Array;
  /** Relógio para `duracaoMs`; o core não lê o relógio sozinho. */
  relogio?: () => number;
}

/** A regra vale para o lote? Sem pacote XSD (XSD não rodou), vale pela versão do leiaute. */
export function aplicavel(regra: Regra, ctx: ContextoRegra): boolean {
  const { versao, pacoteDe, pacoteAte } = regra.leiautes;
  if (versao !== ctx.auditoria.leiaute) return false;
  const pacote = ctx.auditoria.pacoteXsd;
  if (!pacote) return true;
  return pacoteDe <= pacote && (pacoteAte === undefined || pacote <= pacoteAte);
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Ordem estável do relatório: regra, CPF, arquivo, posição, caminho, campo, chave. */
function compararAchados(a: Achado, b: Achado): number {
  return (
    comparar(a.regra, b.regra) ||
    comparar(a.cpf ?? '', b.cpf ?? '') ||
    comparar(a.arquivo, b.arquivo) ||
    a.posicaoNoLote - b.posicaoNoLote ||
    comparar(a.caminho ?? '', b.caminho ?? '') ||
    comparar(a.campo ?? '', b.campo ?? '') ||
    comparar(a.chave, b.chave)
  );
}

function completar(
  regra: Regra,
  bruto: AchadoBruto,
  ctx: ContextoRegra,
  segredo: Uint8Array,
): Achado {
  const severidade = bruto.severidade ?? regra.severidade;
  if (GRAVIDADE[severidade] < GRAVIDADE[regra.severidade]) {
    throw new Error(`${regra.codigo} só pode rebaixar a severidade`);
  }
  const { competencia } = ctx.auditoria;
  const o = bruto.origem;
  return {
    regra: regra.codigo,
    regraVersao: regra.versao,
    severidade,
    competencia,
    ...(bruto.cpf ? { cpf: bruto.cpf } : {}),
    ...(bruto.matricula ? { matricula: bruto.matricula } : {}),
    evento: o.tipo,
    eventoId: o.eventoId,
    arquivo: o.arquivo,
    posicaoNoLote: o.posicaoNoLote,
    ...(o.caminho ? { caminho: o.caminho } : {}),
    ...(bruto.campo ? { campo: bruto.campo } : {}),
    ...(bruto.valores ? { valores: bruto.valores } : {}),
    ...(bruto.causa ? { causa: bruto.causa } : {}),
    chave: chaveDoAchado(segredo, {
      regra: regra.codigo,
      ...(bruto.cpf ? { cpf: bruto.cpf } : {}),
      ...(bruto.campo ? { campo: bruto.campo } : {}),
      competencia,
      ...(bruto.discriminador ? { discriminador: bruto.discriminador } : {}),
    }),
  };
}

/**
 * Roda as regras em ordem de código, isolando falhas: uma regra que lança vira
 * "não executada" e as outras continuam. Regra fora da faixa de leiaute também
 * vira "não executada" — nunca silêncio.
 */
export function executarRegras(
  regras: readonly Regra[],
  ctx: ContextoRegra,
  { segredo, relogio = () => 0 }: OpcoesMotor,
): ResultadoMotor {
  const inicio = relogio();
  const achados: Achado[] = [];
  const regrasExecutadas: { codigo: string; versao: number }[] = [];
  const naoExecutadas: RegraNaoExecutada[] = [];

  for (const regra of [...regras].sort((a, b) => comparar(a.codigo, b.codigo))) {
    const id = { codigo: regra.codigo, versao: regra.versao };
    if (!aplicavel(regra, ctx)) {
      naoExecutadas.push({ ...id, motivo: 'leiaute-nao-suportado' });
      continue;
    }
    if (!ctx.modeloDisponivel && !regra.independeDoModelo) {
      naoExecutadas.push({ ...id, motivo: 'modelo-indisponivel' });
      continue;
    }
    if (regra.requerXsd && !ctx.xsd.executado) {
      naoExecutadas.push({ ...id, motivo: 'xsd-nao-executado' });
      continue;
    }
    try {
      const daRegra = regra.executar(ctx).map((b) => completar(regra, b, ctx, segredo));
      achados.push(...daRegra);
      regrasExecutadas.push(id);
    } catch (erro) {
      naoExecutadas.push({
        ...id,
        motivo: 'falhou',
        erro: erro instanceof Error ? erro.name : 'desconhecido',
      });
    }
  }

  return {
    achados: achados.sort(compararAchados),
    regrasExecutadas,
    naoExecutadas,
    duracaoMs: relogio() - inicio,
  };
}
