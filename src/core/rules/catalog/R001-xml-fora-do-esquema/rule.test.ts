import { describe, expect, it } from 'vitest';
import { umaAuditoria } from '../../../../../test/builders/modelo';
import { TABELAS_S_1_3 } from '../../../leiaute/S-1.3/tabelas';
import type { EventoReprovado } from '../../../xsd/validar-eventos';
import { executarRegras } from '../../engine';
import { R001 } from './rule';

const SEGREDO = new TextEncoder().encode('segredo-de-teste');
const reprovado = (id: string, total: number): EventoReprovado => ({
  evento: {
    arquivo: 'lote.zip/a.xml',
    posicaoNoLote: 2,
    tipo: 'S-1200',
    leiaute: 'S-1.3',
    namespace: '',
    id,
    xml: '<x/>',
  },
  erros: Array.from({ length: Math.min(total, 5) }, (_, i) => ({
    linha: i + 1,
    coluna: 0,
    mensagem: `erro ${i + 1}`,
  })),
  total,
});
const rodar = (reprovados: EventoReprovado[], executado = true) =>
  executarRegras(
    [R001],
    {
      auditoria: umaAuditoria().construir(),
      tabelas: TABELAS_S_1_3,
      modeloDisponivel: true,
      xsd: { executado, reprovados },
    },
    { segredo: SEGREDO },
  );

describe('R001', () => {
  it('um achado por evento reprovado, com o total e até 5 mensagens com linha e coluna', () => {
    const [achado, ...resto] = rodar([reprovado('ID-A', 7)]).achados;
    expect(resto).toEqual([]);
    expect(achado).toMatchObject({
      regra: 'R001',
      severidade: 'erro',
      evento: 'S-1200',
      eventoId: 'ID-A',
      arquivo: 'lote.zip/a.xml',
      posicaoNoLote: 2,
      valores: { total: 7, erro1: 'linha 1, coluna 0: erro 1', erro5: 'linha 5, coluna 0: erro 5' },
    });
    expect(achado?.valores).not.toHaveProperty('erro6');
  });

  it('a chave muda com o evento e se repete para o mesmo evento', () => {
    const a = rodar([reprovado('ID-A', 1), reprovado('ID-B', 1)]).achados.map((x) => x.chave);
    expect(new Set(a).size).toBe(2);
    expect(rodar([reprovado('ID-A', 3)]).achados[0]?.chave).toBe(a[0]);
  });

  it('sem reprovados, sem achados', () => {
    expect(rodar([]).achados).toEqual([]);
  });

  it('sem XSD, não executada (nunca "tudo certo")', () => {
    expect(rodar([], false).naoExecutadas).toEqual([
      { codigo: 'R001', versao: 1, motivo: 'xsd-nao-executado' },
    ]);
  });
});
