// Contrato do catálogo (nível 3): vale para toda regra do registro. Inclui o nível 2:
// fixtures/dispara.xml e limpo.xml de cada regra passam pelo caminho inteiro.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { carregarPacote, listarPacotes } from '../scripts/lib/pacotes-xsd';
import { auditar } from '../src/core/audit';
import { TABELAS_S_1_3 } from '../src/core/leiaute/S-1.3/tabelas';
import { REGRAS } from '../src/core/rules/registry';
import type { ContextoRegra } from '../src/core/rules/tipos';
import { criarValidadorLibxml2 } from '../src/core/xsd/libxml2';
import { umaAuditoria } from './builders/modelo';

const CATALOGO = 'src/core/rules/catalog';
const DOC = readFileSync('docs/arquitetura.md', 'utf8');
const SEGREDO = new TextEncoder().encode('segredo-do-contrato');
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const pastaDa = (codigo: string) => readdirSync(CATALOGO).find((p) => p.startsWith(`${codigo}-`));

const validador = criarValidadorLibxml2(carregarPacote(listarPacotes().at(-1) ?? ''));
afterAll(() => validador.dispose());

function auditarFixture(caminho: string) {
  const r = auditar([{ nome: 'fixture.xml', bytes: new Uint8Array(readFileSync(caminho)) }], {
    validador,
    segredo: SEGREDO,
  });
  if (r.recusa) throw new Error('fixture recusada');
  return r;
}

it('códigos únicos, no formato R000, em ordem', () => {
  const codigos = REGRAS.map((r) => r.codigo);
  expect(new Set(codigos).size).toBe(codigos.length);
  expect(codigos.every((c) => /^R\d{3}$/.test(c))).toBe(true);
  expect([...codigos].sort()).toEqual(codigos);
});

it('toda pasta do catálogo tem regra no registro', () => {
  const codigosDasPastas = readdirSync(CATALOGO).map((p) => p.slice(0, 4));
  expect(codigosDasPastas.sort()).toEqual(REGRAS.map((r) => r.codigo));
});

describe.each(REGRAS.map((r) => [r.codigo, r] as const))('%s', (codigo, regra) => {
  const pasta = pastaDa(codigo);

  it('tem pasta com rule.ts, rule.test.ts, README.md e as duas fixtures', () => {
    expect(pasta, 'pasta do catálogo').toBeDefined();
    for (const arquivo of [
      'rule.ts',
      'rule.test.ts',
      'README.md',
      'fixtures/dispara.xml',
      'fixtures/limpo.xml',
    ]) {
      expect(existsSync(join(CATALOGO, pasta ?? '', arquivo)), arquivo).toBe(true);
    }
  });

  it('tem ficha na seção 11 do doc', () => {
    expect(DOC).toMatch(new RegExp(`^### ${codigo} · `, 'm'));
  });

  it('metadados válidos', () => {
    expect(Number.isInteger(regra.versao) && regra.versao >= 1).toBe(true);
    expect(['erro', 'alerta', 'info']).toContain(regra.severidade);
    for (const texto of [regra.titulo, regra.explicacao, regra.sugestao])
      expect(texto.trim()).not.toBe('');
    expect(regra.eventos.length).toBeGreaterThan(0);
    expect(regra.leiautes.versao).toBe('S-1.3');
    expect(regra.leiautes.pacoteDe).toMatch(DATA);
    if (regra.leiautes.pacoteAte) {
      expect(regra.leiautes.pacoteAte).toMatch(DATA);
      expect(regra.leiautes.pacoteAte >= regra.leiautes.pacoteDe).toBe(true);
    }
  });

  it('não lança com auditoria vazia e é idempotente sobre o modelo congelado', () => {
    const vazio: ContextoRegra = {
      auditoria: umaAuditoria().construir(),
      tabelas: TABELAS_S_1_3,
      modeloDisponivel: true,
      xsd: { executado: true, reprovados: [] },
    };
    expect(regra.executar(vazio)).toEqual([]);
    const cheio: ContextoRegra = {
      ...vazio,
      auditoria: umaAuditoria()
        .comRubrica('1', 'provento')
        .comRubrica('2', 'desconto')
        .comPessoa('52998224725', (p) =>
          p.comDemonstrativo('A', [
            ['1', 100_00],
            ['2', 30_00],
            ['9', 5_00],
          ]),
        )
        .construir(),
    };
    expect(regra.executar(cheio)).toEqual(regra.executar(cheio));
  });

  it('fixtures/dispara.xml gera achado da regra', () => {
    const r = auditarFixture(join(CATALOGO, pasta ?? '', 'fixtures/dispara.xml'));
    expect(r.motor?.achados.filter((a) => a.regra === codigo).length).toBeGreaterThan(0);
  });

  it('fixtures/limpo.xml não gera achado da regra', () => {
    const r = auditarFixture(join(CATALOGO, pasta ?? '', 'fixtures/limpo.xml'));
    expect(r.motor, 'o motor rodou').toBeDefined();
    expect(r.motor?.achados.filter((a) => a.regra === codigo)).toEqual([]);
  });
});
