import { afterAll, describe, expect, it } from 'vitest';
import { carregarPacote } from '../../scripts/lib/pacotes-xsd';
import { bytes, umEvento, umId, umLote } from '../../test/builders/xml';
import { auditar } from './audit';
import { criarValidadorLibxml2 } from './xsd/libxml2';

const validador = criarValidadorLibxml2(
  carregarPacote('2026-07-01', 'test/fixtures/xsd-brinquedo'),
);
afterAll(() => validador.dispose());

const remun = (cpf: string, id: string) =>
  umEvento({ id, corpo: `<ideTrabalhador><cpfTrab>${cpf}</cpfTrab></ideTrabalhador>` });

describe('auditar', () => {
  const lote = umLote([
    remun('52998224725', umId(1)),
    remun('123', umId(2)),
    umEvento({ evento: 'evtBasesTrab' }),
  ]);
  const entradas = [
    { nome: 'b.xml', bytes: bytes(lote) },
    { nome: 'a.txt', bytes: bytes('oi') },
  ];

  it('com validador: aprovado segue, reprovado vira R001, o resto vai para fora', () => {
    const r = auditar(entradas, { validador });
    if (r.recusa) throw new Error('recusado');
    expect(r.xsd).toBe('validado');
    expect(r.pacoteXsd).toBe('2026-07-01');
    expect(r.eventos.map((e) => e.id)).toEqual([umId(1)]);
    expect(r.reprovados.map((x) => x.evento.id)).toEqual([umId(2)]);
    expect(r.foraDaAuditoria.map((f) => [f.arquivo, f.motivo])).toEqual([
      ['a.txt', 'nao-xml'],
      // O XSD de brinquedo aceita o evento mínimo do builder, mas o parse exige ideEvento.
      ['b.xml', 'leitura-falhou'],
      ['b.xml', 'evento-fora-do-mvp'],
    ]);
    expect(r.modelo.tipo).toBe('sem-remuneracao');
    // O lote do builder não tem assinatura: D-08 aceita e conta.
    expect(r.semAssinatura).toBe(2);
  });

  it('sem validador: nada é descartado e fica registrado que o XSD não rodou', () => {
    const r = auditar(entradas);
    if (r.recusa) throw new Error('recusado');
    expect(r.xsd).toBe('nao-executado');
    expect(r.eventos).toHaveLength(2);
    expect(r.reprovados).toEqual([]);
  });

  it('repassa a recusa do RNF-06', () => {
    const limites = {
      bytesDescompactados: 1e6,
      arquivos: 10,
      taxaCompressao: 100,
      bytesPorXml: 10,
    };
    expect(auditar(entradas, { limites }).recusa?.limite).toBe('tamanho-do-xml');
  });
});
