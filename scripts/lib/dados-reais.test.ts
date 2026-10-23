import { describe, expect, it } from 'vitest';
import { checarArquivos, xmlPermitido } from './dados-reais';

const permitidos = new Set(['52998224725']);

describe('xmlPermitido', () => {
  it('aceita XML em test/ ou em qualquer pasta fixtures/', () => {
    expect(xmlPermitido('test/fixtures/lote.xml')).toBe(true);
    expect(xmlPermitido('test/e2e/lote.xml')).toBe(true);
    expect(xmlPermitido('src/core/rules/catalog/R002-liquido-pagamento/fixtures/dispara.xml')).toBe(
      true,
    );
    expect(xmlPermitido('test\\fixtures\\lote.xml')).toBe(true);
  });

  it('recusa XML em qualquer outro lugar, inclusive local-data/', () => {
    expect(xmlPermitido('local-data/S1200.xml')).toBe(false);
    expect(xmlPermitido('lote.XML')).toBe(false);
    expect(xmlPermitido('src/core/test/lote.xml')).toBe(false);
  });

  it('ignora o que não é .xml', () => {
    expect(xmlPermitido('schemas/xsd/S-1.3/2026-07-01/evtRemun.xsd')).toBe(true);
  });
});

describe('checarArquivos', () => {
  it('passa com CPF fictício permitido', () => {
    const r = checarArquivos([{ caminho: 'a.ts', conteudo: "cpf = '52998224725'" }], permitidos);
    expect(r).toEqual([]);
  });

  it('acusa CPF válido fora da lista, sem expor o CPF', () => {
    const r = checarArquivos(
      [{ caminho: 'b.md', conteudo: 'linha 1\n<cpfTrab>12345678909</cpfTrab>' }],
      permitidos,
    );
    expect(r).toEqual([
      { caminho: 'b.md', linha: 2, motivo: 'cpf-valido', detalhe: '***.456.789-**' },
    ]);
  });

  it('acusa CPF válido formatado', () => {
    const r = checarArquivos([{ caminho: 'c.md', conteudo: 'CPF 123.456.789-09' }], permitidos);
    expect(r).toHaveLength(1);
    expect(r[0]?.motivo).toBe('cpf-valido');
  });

  it('não acusa CPF com DV inválido, dígitos repetidos ou máscara', () => {
    const conteudo = '529.982.247-24 00000000000 ***.456.789-** 52998224724';
    expect(checarArquivos([{ caminho: 'd.md', conteudo }], permitidos)).toEqual([]);
  });

  it('não confunde trecho de número maior com CPF', () => {
    const conteudo = 'ID1112223330000002026102014334200001 1234567890912';
    expect(checarArquivos([{ caminho: 'e.md', conteudo }], permitidos)).toEqual([]);
  });

  it('acusa XML fora de fixtures/ ou test/', () => {
    const r = checarArquivos([{ caminho: 'local-data/x.xml', conteudo: '<a/>' }], permitidos);
    expect(r).toEqual([{ caminho: 'local-data/x.xml', motivo: 'xml-fora-de-fixtures' }]);
  });
});
