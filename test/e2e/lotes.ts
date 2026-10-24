// Lotes fictícios para os testes de ponta a ponta (gerados em memória).
import { zipSync } from 'fflate';
import { umS1010, umS1200, umS1210 } from '../builders/esocial.ts';
import { umId, umLote } from '../builders/xml.ts';

const dv = (base: number[]) => {
  const peso = base.length + 1;
  const resto = (base.reduce((s, d, i) => s + d * (peso - i), 0) * 10) % 11;
  return resto === 10 ? 0 : resto;
};

/** CPF fictício com DV válido, a partir de um número (nunca de pessoa real). */
export function cpfFicticio(n: number): string {
  const base = Array.from(String(100000000 + n).slice(-9), (c) => c.charCodeAt(0) - 48);
  const d1 = dv(base);
  return [...base, d1, dv([...base, d1])].join('');
}

/** Lote "grande" do RNF-02: N trabalhadores com S-1200 (40 rubricas) e S-1210, mais 300 S-1010. */
export function loteGrande(trabalhadores: number): Buffer {
  const enc = new TextEncoder();
  const arquivos: Record<string, Uint8Array> = {};
  const itens = Array.from({ length: 40 }, (_, i) => ({
    codRubr: String(i + 1),
    vrRubr: '100.00',
  }));
  let seq = 1;
  for (let i = 0; i < trabalhadores; i++) {
    const cpf = cpfFicticio(i + 1);
    const dm = [{ ideDmDev: `F${i}`, grupos: [{ matricula: String(i), itens }] }];
    arquivos[`remun/${i}.xml`] = enc.encode(umLote([umS1200({ id: umId(seq++), cpf, dmDev: dm })]));
    arquivos[`pgto/${i}.xml`] = enc.encode(
      umLote([
        umS1210({
          id: umId(seq++),
          cpf,
          perApur: '2026-10',
          pagamentos: [{ ideDmDev: `F${i}`, vrLiq: '4000.00' }],
        }),
      ]),
    );
  }
  for (let r = 1; r <= 300; r++) {
    arquivos[`rubr/${r}.xml`] = enc.encode(
      umLote([umS1010({ id: umId(seq++), codRubr: String(r) })]),
    );
  }
  return Buffer.from(zipSync(arquivos));
}
