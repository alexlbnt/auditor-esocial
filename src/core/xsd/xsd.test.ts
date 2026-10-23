import { afterAll, describe, expect, it } from 'vitest';
import { carregarPacote, listarPacotes } from '../../../scripts/lib/pacotes-xsd';
import { umId } from '../../../test/builders/xml';
import type { EventoBruto } from '../ingest/tipos';
import { criarValidadorLibxml2 } from './libxml2';
import { validarEventos } from './validar-eventos';

// XSD de brinquedo (não o oficial): evento inclui tipos.xsd e importa o xmldsig.
const RAIZ = 'test/fixtures/xsd-brinquedo';
const pacote = carregarPacote('2026-07-01', RAIZ);
const NS = 'http://www.esocial.gov.br/schema/evt/evtRemun/v_S_01_03_00';
const ASSINATURA =
  '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>AA==</SignatureValue></Signature>';

function remun({
  cpf = '52998224725',
  valores = ['100.00'],
  assinatura = true,
  cabecalho = '',
} = {}) {
  const itens = valores.map((v) => `<itensRemun><vrRubr>${v}</vrRubr></itensRemun>`).join('');
  return (
    `${cabecalho}<eSocial xmlns="${NS}"><evtRemun Id="${umId()}">` +
    `<ideTrabalhador><cpfTrab>${cpf}</cpfTrab></ideTrabalhador>${itens}</evtRemun>` +
    `${assinatura ? ASSINATURA : ''}</eSocial>`
  );
}

const validador = criarValidadorLibxml2(pacote);
afterAll(() => validador.dispose());

describe('pacotes no disco', () => {
  it('lista as datas e carrega os .xsd com caminho relativo', () => {
    expect(listarPacotes(RAIZ)).toEqual(['2026-07-01']);
    expect([...pacote.arquivos.keys()]).toEqual([
      'evtRemun.xsd',
      'tipos.xsd',
      'xmldsig-core-schema.xsd',
    ]);
    expect(listarPacotes('pasta/que/nao/existe')).toEqual([]);
  });
});

describe('criarValidadorLibxml2', () => {
  it('aprova XML válido com assinatura (resolve include e import da memória)', () => {
    expect(validador.validar(remun(), NS)).toEqual({ status: 'valido', assinaturaAusente: false });
  });

  it('D-08: aprova sem assinatura e avisa', () => {
    expect(validador.validar(remun({ assinatura: false }), NS)).toEqual({
      status: 'valido',
      assinaturaAusente: true,
    });
  });

  it('D-08 desligado: a falta da assinatura reprova', () => {
    const estrito = criarValidadorLibxml2(pacote, { aceitarSemAssinatura: false });
    try {
      const r = estrito.validar(remun({ assinatura: false }), NS);
      expect(r.status).toBe('invalido');
    } finally {
      estrito.dispose();
    }
  });

  it('reprova CPF fora do padrão e vírgula decimal, com linha', () => {
    const xml = remun({ cpf: '5299822472', valores: ['10,50'] }).replace(
      '<itensRemun>',
      '\n<itensRemun>',
    );
    const r = validador.validar(xml, NS);
    if (r.status !== 'invalido') throw new Error(r.status);
    expect(r.total).toBe(2);
    expect(r.erros.map((e) => e.linha)).toEqual([1, 2]);
    expect(r.erros[0]?.mensagem).toContain('cpfTrab');
    expect(r.erros[1]?.mensagem).toContain('vrRubr');
    expect(r.erros[0]?.caminho).toBeTruthy();
  });

  it('guarda no máximo 5 mensagens, mas conta todas', () => {
    const r = validador.validar(remun({ valores: Array(8).fill('x') }), NS);
    if (r.status !== 'invalido') throw new Error(r.status);
    expect(r.erros).toHaveLength(5);
    expect(r.total).toBe(8);
  });

  it('encoding ISO-8859-1 declarado não gera erro (o texto chega já decodificado)', () => {
    const cabecalho = '<?xml version="1.0" encoding="ISO-8859-1"?>\n';
    const xml = remun({ cabecalho }).replace('<vrRubr>', '<dscRubr>Lotação</dscRubr><vrRubr>');
    expect(validador.validar(xml, NS).status).toBe('valido');
  });

  it('evento sem esquema no pacote', () => {
    const outro = 'http://www.esocial.gov.br/schema/evt/evtPgtos/v_S_01_03_00';
    expect(validador.validar('<eSocial/>', outro)).toEqual({ status: 'sem-esquema' });
  });

  it('XML malformado é erro de entrada, não reprovação', () => {
    const r = validador.validar('<eSocial><a></eSocial>', NS);
    expect(r.status).toBe('malformado');
  });

  it('depois de liberado, não valida mais', () => {
    const v = criarValidadorLibxml2(pacote);
    v.dispose();
    v.dispose();
    expect(() => v.validar(remun(), NS)).toThrow('liberado');
  });

  it('dois pacotes convivem (cada um com o prefixo da sua data)', () => {
    const copia = criarValidadorLibxml2({ data: '2026-10-26', arquivos: pacote.arquivos });
    try {
      expect(copia.validar(remun(), NS).status).toBe('valido');
      expect(validador.validar(remun(), NS).status).toBe('valido');
    } finally {
      copia.dispose();
    }
  });
});

describe('validarEventos', () => {
  const evento = (xml: string, posicaoNoLote: number, namespace = NS): EventoBruto => ({
    arquivo: 'lote.xml',
    posicaoNoLote,
    tipo: 'S-1200',
    leiaute: 'S-1.3',
    namespace,
    id: umId(posicaoNoLote),
    xml,
  });

  it('separa aprovados, reprovados e fora da auditoria, na ordem', () => {
    const r = validarEventos(
      [
        evento(remun(), 1),
        evento(remun({ cpf: '1' }), 2),
        evento(remun({ assinatura: false }), 3),
        evento('<eSocial/>', 4, 'http://www.esocial.gov.br/schema/evt/evtPgtos/v_S_01_03_00'),
        evento('<a><b></a>', 5),
      ],
      validador,
    );
    expect(r.pacoteXsd).toBe('2026-07-01');
    expect(r.aprovados.map((e) => e.posicaoNoLote)).toEqual([1, 3]);
    expect(r.reprovados.map((x) => [x.evento.posicaoNoLote, x.total])).toEqual([[2, 1]]);
    expect(r.foraDaAuditoria).toEqual([
      {
        arquivo: 'lote.xml',
        posicaoNoLote: 4,
        motivo: 'xsd-indisponivel',
        detalhe: 'S-1200 no pacote 2026-07-01',
      },
      {
        arquivo: 'lote.xml',
        posicaoNoLote: 5,
        motivo: 'xml-malformado',
        detalhe: 'linha 1, coluna 11',
      },
    ]);
    expect(r.semAssinatura).toBe(1);
  });
});
