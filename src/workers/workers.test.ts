import { describe, expect, it } from 'vitest';
import { auditar } from '@/core/audit';
import type { Progresso } from '@/core/progresso';
import { bytes, umLote } from '../../test/builders/xml';
import { umS1200 } from '../../test/builders/esocial';
import { limitarProgresso } from './limitar-progresso';
import { resumir } from './resumo';

describe('limitarProgresso', () => {
  it('repassa no máximo a cada intervalo, mas sempre a troca de etapa e o fim', () => {
    let t = 0;
    const repassados: Progresso[] = [];
    const progresso = limitarProgresso(
      (p) => repassados.push(p),
      150,
      () => t,
    );
    for (let i = 0; i <= 1000; i++) {
      t = i; // 1 ms por item
      progresso({ etapa: 'validando', feitos: i, total: 1000 });
    }
    t = 1001;
    progresso({ etapa: 'montando', feitos: 0, total: 10 });
    expect(repassados.map((p) => `${p.etapa}:${p.feitos}`)).toEqual([
      'validando:0', 'validando:150', 'validando:300', 'validando:450', 'validando:600',
      'validando:750', 'validando:900', 'validando:1000', 'montando:0',
    ]); // prettier-ignore
  });
});

describe('resumir', () => {
  const lote = umLote([
    umS1200({
      dmDev: [
        {
          ideDmDev: 'A',
          grupos: [
            { matricula: '0002', itens: [{ codRubr: '1', vrRubr: '1.00' }] },
            { matricula: '0001', itens: [{ codRubr: '1', vrRubr: '1.00' }] },
          ],
        },
      ],
    }),
  ]);
  const resultado = auditar([{ nome: 'a.xml', bytes: bytes(lote) }], {
    segredo: new TextEncoder().encode('s'),
  });

  it('leva para a tela só o necessário, sem o texto dos XMLs', () => {
    const r = resumir(resultado);
    if (r.tipo !== 'concluido') throw new Error(r.tipo);
    expect(r.modelo).toEqual({
      tipo: 'pronta',
      competencia: '2026-09',
      apuracao: 'mensal',
      empregador: '11222333',
    });
    expect(r.eventosPorTipo).toEqual({ 'S-1200': 1 });
    expect(r.trabalhadores).toEqual([{ cpf: '52998224725', matriculas: ['0001', '0002'] }]);
    expect(JSON.stringify(r)).not.toContain('<eSocial');
  });

  it('recusa vira tipo recusado', () => {
    const recusado = auditar([{ nome: 'a.xml', bytes: bytes(lote) }], {
      limites: { bytesDescompactados: 1e6, arquivos: 10, taxaCompressao: 100, bytesPorXml: 10 },
    });
    expect(resumir(recusado)).toMatchObject({
      tipo: 'recusado',
      recusa: { limite: 'tamanho-do-xml' },
    });
  });
});
