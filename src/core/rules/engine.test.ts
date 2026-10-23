import { describe, expect, it } from 'vitest';
import { umaAuditoria, umaOrigem } from '../../../test/builders/modelo';
import type { AchadoBruto } from '../findings/tipos';
import { TABELAS_S_1_3 } from '../leiaute/S-1.3/tabelas';
import { aplicavel, executarRegras } from './engine';
import type { ContextoRegra, Regra } from './tipos';

const SEGREDO = new TextEncoder().encode('segredo-de-teste');
const auditoria = umaAuditoria().comPessoa('52998224725').comPessoa('12345678909').construir();
const ctx = (extra: Partial<ContextoRegra> = {}): ContextoRegra => ({
  auditoria,
  tabelas: TABELAS_S_1_3,
  modeloDisponivel: true,
  xsd: { executado: true, reprovados: [] },
  ...extra,
});

function umaRegra(codigo: string, executar: Regra['executar'], extra: Partial<Regra> = {}): Regra {
  return {
    codigo,
    versao: 1,
    titulo: 't',
    explicacao: 'e',
    sugestao: 's',
    severidade: 'alerta',
    eventos: ['S-1200'],
    leiautes: { versao: 'S-1.3', pacoteDe: '2026-07-01' },
    executar,
    ...extra,
  };
}

const umPorPessoa = (): AchadoBruto[] =>
  [...auditoria.pessoas.keys()].map((cpf) => ({
    cpf,
    origem: umaOrigem(`ID-${cpf}`),
    campo: 'vrLiq',
    valores: { esperado: 100 },
  }));

describe('executarRegras', () => {
  it('completa o achado com código, versão, severidade, competência, origem e chave', () => {
    const r = executarRegras([umaRegra('R010', umPorPessoa)], ctx(), { segredo: SEGREDO });
    expect(r.regrasExecutadas).toEqual([{ codigo: 'R010', versao: 1 }]);
    expect(r.achados[0]).toEqual({
      regra: 'R010',
      regraVersao: 1,
      severidade: 'alerta',
      competencia: '2026-09',
      cpf: '12345678909',
      evento: 'S-1200',
      eventoId: 'ID-12345678909',
      arquivo: 'teste.xml',
      posicaoNoLote: 1,
      campo: 'vrLiq',
      valores: { esperado: 100 },
      chave: expect.stringMatching(/^[a-zA-F]{52}$/),
    });
  });

  it('roda em ordem de código e ordena os achados de forma estável', () => {
    const ordem: string[] = [];
    const registrar = (codigo: string) => () => {
      ordem.push(codigo);
      return umPorPessoa().reverse();
    };
    const r = executarRegras(
      [umaRegra('R003', registrar('R003')), umaRegra('R002', registrar('R002'))],
      ctx(),
      { segredo: SEGREDO },
    );
    expect(ordem).toEqual(['R002', 'R003']);
    expect(r.achados.map((a) => [a.regra, a.cpf])).toEqual([
      ['R002', '12345678909'],
      ['R002', '52998224725'],
      ['R003', '12345678909'],
      ['R003', '52998224725'],
    ]);
  });

  it('isola a falha: a regra que lança vira "não executada" (só o nome do erro) e as outras seguem', () => {
    const quebrada = umaRegra('R005', () => {
      throw new TypeError('cpf 52998224725 sumiu');
    });
    const r = executarRegras([quebrada, umaRegra('R006', umPorPessoa)], ctx(), {
      segredo: SEGREDO,
    });
    expect(r.naoExecutadas).toEqual([
      { codigo: 'R005', versao: 1, motivo: 'falhou', erro: 'TypeError' },
    ]);
    expect(r.regrasExecutadas).toEqual([{ codigo: 'R006', versao: 1 }]);
    expect(JSON.stringify(r.naoExecutadas)).not.toMatch(/\d{11}/);
  });

  it('a regra pode rebaixar a severidade, nunca subir', () => {
    const rebaixa = umaRegra('R002', () => [{ origem: umaOrigem(), severidade: 'info' }]);
    expect(executarRegras([rebaixa], ctx(), { segredo: SEGREDO }).achados[0]?.severidade).toBe(
      'info',
    );
    const sobe = umaRegra('R003', () => [{ origem: umaOrigem(), severidade: 'erro' }]);
    expect(executarRegras([sobe], ctx(), { segredo: SEGREDO }).naoExecutadas).toMatchObject([
      { codigo: 'R003', motivo: 'falhou' },
    ]);
  });

  it('regra fora da faixa de leiaute ou sem o XSD vira "não executada", nunca silêncio', () => {
    const futura = umaRegra('R007', umPorPessoa, {
      leiautes: { versao: 'S-1.3', pacoteDe: '2027-01-18' },
    });
    const precisaXsd = umaRegra('R001', umPorPessoa, { requerXsd: true });
    const r = executarRegras(
      [futura, precisaXsd],
      ctx({ xsd: { executado: false, reprovados: [] } }),
      { segredo: SEGREDO },
    );
    expect(r.naoExecutadas.map((n) => [n.codigo, n.motivo])).toEqual([
      ['R001', 'xsd-nao-executado'],
      ['R007', 'leiaute-nao-suportado'],
    ]);
    expect(r.achados).toEqual([]);
  });

  it('mede a duração com o relógio de quem chama', () => {
    let t = 100;
    const r = executarRegras([umaRegra('R002', () => [])], ctx(), {
      segredo: SEGREDO,
      relogio: () => (t += 5),
    });
    expect(r.duracaoMs).toBe(5);
  });
});

describe('aplicavel', () => {
  const regra = umaRegra('R002', () => [], {
    leiautes: { versao: 'S-1.3', pacoteDe: '2026-07-01', pacoteAte: '2026-12-14' },
  });
  const com = (pacoteXsd?: string) =>
    ctx({ auditoria: { ...auditoria, ...(pacoteXsd ? { pacoteXsd } : { pacoteXsd: undefined }) } });

  it.each([
    ['2026-04-27', false],
    ['2026-07-01', true],
    ['2026-10-26', true],
    ['2026-12-14', true],
    ['2027-01-18', false],
  ])('pacote %s -> %s', (pacote, esperado) => {
    expect(aplicavel(regra, com(pacote))).toBe(esperado);
  });

  it('sem pacote (XSD não rodou), vale pela versão do leiaute', () => {
    expect(aplicavel(regra, com(undefined))).toBe(true);
  });
});

describe('sem modelo', () => {
  it('só roda regra que independe do modelo; as outras ficam "modelo indisponível"', () => {
    const relata = umaRegra('R001', () => [{ origem: umaOrigem() }], { independeDoModelo: true });
    const precisa = umaRegra('R002', umPorPessoa);
    const r = executarRegras([precisa, relata], ctx({ modeloDisponivel: false }), {
      segredo: SEGREDO,
    });
    expect(r.regrasExecutadas).toEqual([{ codigo: 'R001', versao: 1 }]);
    expect(r.naoExecutadas).toEqual([{ codigo: 'R002', versao: 1, motivo: 'modelo-indisponivel' }]);
  });
});
