// Lotes fictícios para os testes de ponta a ponta (gerados em memória).
import { zipSync } from 'fflate';
import { umS1010, umS1200, umS1210, umS2299 } from '../builders/esocial.ts';
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
export function loteGrande(trabalhadores: number, vrLiq = '4000.00'): Buffer {
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
          pagamentos: [{ ideDmDev: `F${i}`, vrLiq }],
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

/** Um erro de cada regra (como o lote golden): R001, R002, R003 e rubrica sem cadastro. */
export function loteDoRelatorio(): Buffer {
  const enc = new TextEncoder();
  const item = (codRubr: string, vrRubr: string) => ({ codRubr, vrRubr });
  const [a, b, c] = [cpfFicticio(1), cpfFicticio(2), cpfFicticio(3)];
  return Buffer.from(
    enc.encode(
      umLote([
        umS1010({ id: umId(901), codRubr: '1' }),
        umS1010({
          id: umId(902),
          codRubr: '50',
          tpRubr: '2',
          natRubr: '9201',
          codIncCP: '31',
          codIncIRRF: '31',
          codIncFGTS: '00',
        }),
        // A: líquido diferente (R002 erro)
        umS1200({
          id: umId(1),
          cpf: a,
          dmDev: [
            {
              ideDmDev: 'FA',
              grupos: [{ matricula: '0001', itens: [item('1', '3000.00'), item('50', '300.00')] }],
            },
          ],
        }),
        umS1210({
          id: umId(2),
          cpf: a,
          perApur: '2026-10',
          pagamentos: [{ ideDmDev: 'FA', vrLiq: '2760.00' }],
        }),
        // B: desligado antes da competência (R003) e rubrica sem S-1010 (R002 alerta)
        umS1200({
          id: umId(3),
          cpf: b,
          dmDev: [
            {
              ideDmDev: 'FB',
              grupos: [{ matricula: '0002', itens: [item('1', '1000.00'), item('77', '10.00')] }],
            },
          ],
        }),
        umS1210({
          id: umId(4),
          cpf: b,
          perApur: '2026-10',
          pagamentos: [{ ideDmDev: 'FB', vrLiq: '1010.00' }],
        }),
        umS2299({ id: umId(5), cpf: b, matricula: '0002', dtDeslig: '2026-08-15' }),
        // C: limpo
        umS1200({
          id: umId(6),
          cpf: c,
          dmDev: [
            { ideDmDev: 'FC', grupos: [{ matricula: '0003', itens: [item('1', '2000.00')] }] },
          ],
        }),
        umS1210({
          id: umId(7),
          cpf: c,
          perApur: '2026-10',
          pagamentos: [{ ideDmDev: 'FC', vrLiq: '2000.00' }],
        }),
        // R001: CPF com 10 dígitos
        umS1200({
          id: umId(8),
          cpf: '1234567890',
          dmDev: [{ ideDmDev: 'X', grupos: [{ itens: [item('1', '1.00')] }] }],
        }),
      ]),
    ),
  );
}
