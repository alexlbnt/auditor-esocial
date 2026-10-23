import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { bytes, umEvento, umId, umLote } from '../../../test/builders/xml';
import { LIMITES_RNF06, lerLote, type ArquivoEntrada, type ResultadoIngest } from './index';

function ok(r: ResultadoIngest) {
  if (r.recusa) throw new Error(`lote recusado: ${r.recusa.limite}`);
  return r;
}

const xml = (nome: string, texto: string): ArquivoEntrada => ({ nome, bytes: bytes(texto) });

describe('lerLote: fixture anonimizada (envelope real)', () => {
  it('acha o S-1200 dentro do envelope do lote, com o Id do evento', () => {
    const fixture = readFileSync('test/fixtures/s1200-lote-anonimizado.xml');
    const r = ok(lerLote([{ nome: 'lote.xml', bytes: new Uint8Array(fixture) }]));
    expect(r.foraDaAuditoria).toEqual([]);
    expect(r.eventos).toHaveLength(1);
    const [evento] = r.eventos;
    expect(evento).toMatchObject({
      arquivo: 'lote.xml',
      posicaoNoLote: 1,
      tipo: 'S-1200',
      leiaute: 'S-1.3',
      id: 'ID1112223330000002026102014334200001',
    });
    expect(evento?.xml).toMatch(
      /^<eSocial xmlns:xsi="[^"]+" xmlns:xsd="[^"]+" xmlns="http:\/\/www\.esocial\.gov\.br\/schema\/evt\/evtRemun\/v_S_01_03_00">/,
    );
    expect(evento?.xml.endsWith('</evtRemun></eSocial>')).toBe(true);
  });
});

describe('lerLote: identificação', () => {
  it('aceita o evento solto, com declaração XML e assinatura', () => {
    const texto =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      umEvento({ evento: 'evtPgtos', id: umId(7), corpo: '<a/>' }).replace(
        '</eSocial>',
        '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"/></eSocial>',
      );
    const r = ok(lerLote([xml('pgto.xml', texto)]));
    expect(r.eventos).toMatchObject([{ tipo: 'S-1210', id: umId(7), posicaoNoLote: 1 }]);
  });

  it('separa vários eventos de um envelope, guardando a posição', () => {
    const lote = umLote([
      umEvento({ evento: 'evtTabRubrica', id: umId(1) }),
      umEvento({ evento: 'evtRemun', id: umId(2) }),
      umEvento({ evento: 'evtDeslig', id: umId(3) }),
    ]);
    const r = ok(lerLote([xml('lote.xml', lote)]));
    expect(r.eventos.map((e) => [e.posicaoNoLote, e.tipo, e.id])).toEqual([
      [1, 'S-1010', umId(1)],
      [2, 'S-1200', umId(2)],
      [3, 'S-2299', umId(3)],
    ]);
  });

  it('reconhece os sete eventos do MVP', () => {
    const nomes = [
      'evtTabRubrica',
      'evtRemun',
      'evtRmnRPPS',
      'evtBenPrRP',
      'evtPgtos',
      'evtFechaEvPer',
      'evtDeslig',
    ];
    const r = ok(lerLote([xml('lote.xml', umLote(nomes.map((evento) => umEvento({ evento }))))]));
    expect(r.eventos.map((e) => e.tipo)).toEqual([
      'S-1010',
      'S-1200',
      'S-1202',
      'S-1207',
      'S-1210',
      'S-1299',
      'S-2299',
    ]);
  });

  it('lista evento fora do MVP, exclusão e leiaute não suportado', () => {
    const lote = umLote([
      umEvento({ evento: 'evtBasesTrab' }),
      umEvento({ evento: 'evtExclusao' }),
      umEvento({ evento: 'evtRemun', versao: 'v_S_01_02_00' }),
    ]);
    const r = ok(lerLote([xml('lote.xml', lote)]));
    expect(r.eventos).toEqual([]);
    expect(r.foraDaAuditoria).toEqual([
      {
        arquivo: 'lote.xml',
        posicaoNoLote: 1,
        motivo: 'evento-fora-do-mvp',
        detalhe: 'evtBasesTrab',
      },
      {
        arquivo: 'lote.xml',
        posicaoNoLote: 2,
        motivo: 'exclusao-nao-considerada',
        detalhe: 'evtExclusao',
      },
      {
        arquivo: 'lote.xml',
        posicaoNoLote: 3,
        motivo: 'leiaute-nao-suportado',
        detalhe: 'S-1200 v_S_01_02_00',
      },
    ]);
  });

  it('lista XML que não é evento nem lote', () => {
    const r = ok(lerLote([xml('retorno.xml', '<retorno xmlns="urn:outro"><a/></retorno>')]));
    expect(r.foraDaAuditoria).toEqual([
      {
        arquivo: 'retorno.xml',
        posicaoNoLote: 1,
        motivo: 'xml-nao-reconhecido',
        detalhe: 'urn:outro',
      },
    ]);
  });

  it('lista lote vazio', () => {
    const r = ok(lerLote([xml('lote.xml', umLote([]))]));
    expect(r.foraDaAuditoria).toMatchObject([
      { motivo: 'xml-nao-reconhecido', detalhe: 'lote sem eventos' },
    ]);
  });

  it('evento sem Id segue com Id vazio (o XSD acusa)', () => {
    const texto = umEvento().replace(/ Id="[^"]*"/, '');
    expect(ok(lerLote([xml('a.xml', texto)])).eventos[0]?.id).toBe('');
  });
});

describe('lerLote: problemas de entrada', () => {
  it('XML malformado é erro de entrada, sem citar o conteúdo', () => {
    const r = ok(lerLote([xml('quebrado.xml', '<eSocial><cpfTrab>52998224725</eSocial>')]));
    expect(r.foraDaAuditoria).toHaveLength(1);
    const [item] = r.foraDaAuditoria;
    expect(item?.motivo).toBe('xml-malformado');
    expect(item?.detalhe).toMatch(/^\w+ \(linha \d+, coluna \d+\)$/);
  });

  it('o trecho do evento herda os prefixos declarados no envelope', () => {
    // O prefixo xsi está declarado só no envelope; sem ele o trecho seria XML inválido.
    const lote = umLote([umEvento({ corpo: '<a xsi:nil="true"/>' })]);
    const r = ok(lerLote([xml('lote.xml', lote)]));
    expect(r.foraDaAuditoria).toEqual([]);
    expect(r.eventos[0]?.xml).toMatch(
      /^<eSocial xmlns:xsi="http:\/\/www\.w3\.org\/2001\/XMLSchema-instance" xmlns="http:\/\/www\.esocial\.gov\.br\/schema\/evt\/evtRemun\//,
    );
  });

  it('trecho de evento malformado dentro de um envelope bem-formado', () => {
    // O arquivo é bem-formado, mas o evento tem duas raízes: sozinho, não é um documento XML.
    const r = ok(lerLote([xml('lote.xml', umLote([`${umEvento()}${umEvento()}`]))]));
    expect(r.eventos).toEqual([]);
    expect(r.foraDaAuditoria).toMatchObject([{ posicaoNoLote: 1, motivo: 'xml-malformado' }]);
  });

  it('decodifica pelo encoding declarado', () => {
    // "Lotação" em ISO-8859-1: o "ç" e o "ã" são um byte cada.
    const texto = `<?xml version="1.0" encoding="ISO-8859-1"?>${umEvento({ corpo: '<x>Lotação</x>' })}`;
    const latin1 = Uint8Array.from(texto, (c) => c.charCodeAt(0));
    const r = ok(lerLote([{ nome: 'a.xml', bytes: latin1 }]));
    expect(r.eventos[0]?.xml).toContain('Lotação');
  });

  it('encoding desconhecido ou bytes inválidos', () => {
    const desconhecido = xml('a.xml', `<?xml version="1.0" encoding="EBCDIC-XYZ"?>${umEvento()}`);
    const utf8Invalido = { nome: 'b.xml', bytes: Uint8Array.of(0x3c, 0x61, 0xff, 0x3e) };
    const r = ok(lerLote([desconhecido, utf8Invalido]));
    expect(r.foraDaAuditoria.map((f) => f.motivo)).toEqual([
      'encoding-nao-suportado',
      'encoding-nao-suportado',
    ]);
  });

  it('arquivo que não é XML vai para fora da auditoria', () => {
    const r = ok(lerLote([xml('leia-me.txt', 'oi')]));
    expect(r.foraDaAuditoria).toEqual([{ arquivo: 'leia-me.txt', motivo: 'nao-xml' }]);
  });
});

describe('lerLote: zip', () => {
  it('abre zip, ignora pastas e mantém a ordem por caminho', () => {
    const zip = zipSync({
      'b/2.xml': bytes(umEvento({ id: umId(2) })),
      'a/': new Uint8Array(),
      'a/1.xml': bytes(umEvento({ id: umId(1) })),
    });
    const r = ok(lerLote([{ nome: 'lote.zip', bytes: zip }]));
    expect(r.eventos.map((e) => e.arquivo)).toEqual(['lote.zip/a/1.xml', 'lote.zip/b/2.xml']);
  });

  it('abre um nível de zip dentro de zip; mais fundo vai para fora da auditoria', () => {
    const fundo = zipSync({ 'x.xml': bytes(umEvento()) });
    const meio = zipSync({ 'ok.xml': bytes(umEvento()), 'fundo.zip': fundo }, { level: 0 });
    const r = ok(
      lerLote([{ nome: 'lote.zip', bytes: zipSync({ 'meio.zip': meio }, { level: 0 }) }]),
    );
    expect(r.eventos.map((e) => e.arquivo)).toEqual(['lote.zip/meio.zip/ok.xml']);
    expect(r.foraDaAuditoria).toEqual([
      { arquivo: 'lote.zip/meio.zip/fundo.zip', motivo: 'zip-aninhado' },
    ]);
  });

  it('zip corrompido vai para fora da auditoria', () => {
    const zip = zipSync({ 'a.xml': bytes(umEvento()) });
    const r = ok(lerLote([{ nome: 'lote.zip', bytes: zip.subarray(0, 20) }]));
    expect(r.foraDaAuditoria).toEqual([{ arquivo: 'lote.zip', motivo: 'zip-corrompido' }]);
  });

  it('mesma entrada em outra ordem dá o mesmo resultado', () => {
    const a = xml('a.xml', umEvento({ id: umId(1) }));
    const b = xml('b.xml', umEvento({ id: umId(2) }));
    expect(lerLote([b, a])).toEqual(lerLote([a, b]));
  });
});

describe('lerLote: limites do RNF-06', () => {
  it('os limites padrão são os do RNF-06', () => {
    expect(LIMITES_RNF06).toEqual({
      bytesDescompactados: 150 * 1024 * 1024,
      arquivos: 50_000,
      taxaCompressao: 100,
      bytesPorXml: 10 * 1024 * 1024,
    });
  });

  const limites = { bytesDescompactados: 1000, arquivos: 3, taxaCompressao: 100, bytesPorXml: 400 };

  it('recusa zip-bomba pela taxa declarada, antes de descompactar', () => {
    const bomba = zipSync({ 'zeros.xml': new Uint8Array(200_000) });
    const r = lerLote([{ nome: 'lote.zip', bytes: bomba }], {
      ...limites,
      bytesDescompactados: 1e9,
      bytesPorXml: 1e9,
    });
    expect(r.recusa).toMatchObject({
      limite: 'taxa-de-compressao',
      arquivo: 'lote.zip/zeros.xml',
      maximo: 100,
    });
  });

  it('recusa lote com arquivos demais, contando os de dentro do zip', () => {
    const zip = zipSync({ '1.txt': bytes('1'), '2.txt': bytes('2'), '3.txt': bytes('3') });
    const r = lerLote([{ nome: 'lote.zip', bytes: zip }, xml('4.txt', '4')], limites);
    expect(r.recusa).toEqual({ limite: 'quantidade-de-arquivos', valor: 4, maximo: 3 });
  });

  it('recusa lote grande demais depois de descompactado', () => {
    const r = lerLote([xml('a.txt', 'x'.repeat(600)), xml('b.txt', 'x'.repeat(600))], limites);
    expect(r.recusa).toEqual({ limite: 'tamanho-descompactado', valor: 1200, maximo: 1000 });
  });

  it('recusa XML individual acima do limite', () => {
    const r = lerLote([xml('grande.xml', 'x'.repeat(401))], limites);
    expect(r.recusa).toEqual({
      limite: 'tamanho-do-xml',
      arquivo: 'grande.xml',
      valor: 401,
      maximo: 400,
    });
  });
});
