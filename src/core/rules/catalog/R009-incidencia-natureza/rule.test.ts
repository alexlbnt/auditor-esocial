import { describe, expect, it } from 'vitest';
import { umaAuditoria } from '../../../../../test/builders/modelo';
import { TABELAS_S_1_3, type TabelasLeiaute } from '../../../leiaute/S-1.3/tabelas';
import type { Auditoria } from '../../../model/tipos';
import { executarRegras } from '../../engine';
import { TABELAS_FICTICIAS } from './fixtures/contexto';
import { R009 } from './rule';

const SEGREDO = new TextEncoder().encode('segredo-de-teste');
const rodar = (auditoria: Readonly<Auditoria>, tabelas: TabelasLeiaute = TABELAS_FICTICIAS) =>
  executarRegras(
    [R009],
    { auditoria, tabelas, modeloDisponivel: true, xsd: { executado: true, reprovados: [] } },
    { segredo: SEGREDO },
  ).achados;

describe('R009 (com a tabela FICTÍCIA dos testes)', () => {
  it('dispara uma vez por incidência fora do esperado, agrupando pela rubrica', () => {
    const a = umaAuditoria().comRubrica('1', 'provento', {
      natureza: '1000',
      incidencias: { inss: '00', irrf: '00', fgts: '11' },
    });
    expect(rodar(a.construir())).toMatchObject([
      {
        regra: 'R009',
        severidade: 'alerta',
        evento: 'S-1010',
        campo: 'codIncCP',
        causa: 'rubrica:1|001',
        valores: { natureza: '1000', encontrado: '00', esperado: '11' },
      },
      {
        campo: 'codIncIRRF',
        causa: 'rubrica:1|001',
        valores: { encontrado: '00', esperado: '11' },
      },
    ]);
  });

  it('não dispara quando a incidência está entre as esperadas', () => {
    const a = umaAuditoria().comRubrica('1', 'provento', { natureza: '1000' });
    expect(rodar(a.construir())).toEqual([]);
  });

  it('natureza fora da tabela: silêncio', () => {
    const a = umaAuditoria().comRubrica('1', 'provento', {
      natureza: '5555',
      incidencias: { inss: '00', irrf: '00', fgts: '00' },
    });
    expect(rodar(a.construir())).toEqual([]);
  });

  it('incidência que a linha não confere fica de fora', () => {
    // A linha fictícia não diz nada de FGTS.
    const a = umaAuditoria().comRubrica('1', 'provento', {
      natureza: '1000',
      incidencias: { inss: '11', irrf: '11', fgts: '99' },
    });
    expect(rodar(a.construir())).toEqual([]);
  });

  it('sem S-1010 no lote (nenhuma rubrica): silêncio (a R008 avisa)', () => {
    expect(rodar(umaAuditoria().construir())).toEqual([]);
  });
});

describe('R009 com a tabela real', () => {
  it('a tabela curada começa vazia: nenhuma linha foi inventada', () => {
    expect(TABELAS_S_1_3.naturezaIncidencia).toEqual([]);
    const a = umaAuditoria().comRubrica('1', 'provento', {
      natureza: '1000',
      incidencias: { inss: '00', irrf: '00', fgts: '00' },
    });
    expect(rodar(a.construir(), TABELAS_S_1_3)).toEqual([]);
  });
});
