// R001 contra os pacotes XSD oficiais em schemas/xsd/S-1.3/: sem erro falso na
// fixture anonimizada (estrutura do S-1200 real) e reprovação do que é inválido.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carregarPacote, listarPacotes } from '../scripts/lib/pacotes-xsd';
import { auditar } from '../src/core/audit';
import { EVENTO_EXCLUSAO, EVENTOS_DO_MVP } from '../src/core/leiaute/eventos';
import { criarValidadorLibxml2 } from '../src/core/xsd/libxml2';

const fixture = readFileSync('test/fixtures/s1200-lote-anonimizado.xml', 'utf8');
const entrada = (texto: string) => [{ nome: 'lote.xml', bytes: new TextEncoder().encode(texto) }];
const pacotes = listarPacotes();

it('há pacotes oficiais no repositório', () => {
  expect(pacotes).toEqual(expect.arrayContaining(['2026-07-01', '2026-10-26']));
});

describe.each(pacotes)('pacote oficial %s', (data) => {
  const pacote = carregarPacote(data);

  it('tem esquema para os sete eventos do MVP e para o S-3000', () => {
    const v = criarValidadorLibxml2(pacote);
    try {
      for (const evento of [...Object.keys(EVENTOS_DO_MVP), EVENTO_EXCLUSAO]) {
        const ns = `http://www.esocial.gov.br/schema/evt/${evento}/v_S_01_03_00`;
        expect(v.validar('<eSocial/>', ns).status, evento).not.toBe('sem-esquema');
      }
    } finally {
      v.dispose();
    }
  });

  it('aprova a fixture anonimizada sem assinatura (D-08), sem R001 falso', () => {
    const v = criarValidadorLibxml2(pacote);
    try {
      const r = auditar(entrada(fixture), { validador: v });
      if (r.recusa) throw new Error('recusado');
      expect(r.reprovados).toEqual([]);
      expect(r.eventos).toHaveLength(1);
      expect(r.semAssinatura).toBe(1);
      // E segue até o modelo canônico.
      if (r.modelo.tipo !== 'pronta') throw new Error(r.modelo.tipo);
      expect(r.modelo.auditoria).toMatchObject({ pacoteXsd: data, competencia: '2026-09' });
      expect(r.modelo.auditoria.pessoas.get('52998224725')?.demonstrativos).toHaveLength(1);
    } finally {
      v.dispose();
    }
  });

  it('o XSD oficial exige a assinatura: sem a D-08, a fixture seria reprovada', () => {
    const v = criarValidadorLibxml2(pacote, { aceitarSemAssinatura: false });
    try {
      const r = auditar(entrada(fixture), { validador: v });
      if (r.recusa) throw new Error('recusado');
      expect(r.reprovados).toHaveLength(1);
      expect(r.reprovados[0]?.erros[0]?.mensagem).toContain('xmldsig#}Signature');
    } finally {
      v.dispose();
    }
  });

  it('reprova CPF com 10 dígitos e valor com vírgula', () => {
    const ruim = fixture
      .replace('<cpfTrab>52998224725', '<cpfTrab>5299822472')
      .replace('<vrRubr>500.00', '<vrRubr>500,00');
    const v = criarValidadorLibxml2(pacote);
    try {
      const r = auditar(entrada(ruim), { validador: v });
      if (r.recusa) throw new Error('recusado');
      expect(r.reprovados[0]?.total).toBe(2);
      expect(r.reprovados[0]?.erros.map((e) => e.mensagem.match(/\}(\w+)'/)?.[1])).toEqual([
        'cpfTrab',
        'vrRubr',
      ]);
    } finally {
      v.dispose();
    }
  });
});
