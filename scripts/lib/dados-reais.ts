import { cpfTemDvValido, mascararCpf } from '../../src/core/findings/cpf.ts';

export interface ArquivoVersionado {
  caminho: string;
  conteudo: string;
}

export interface Problema {
  caminho: string;
  linha?: number;
  motivo: 'xml-fora-de-fixtures' | 'cpf-valido';
  /** Nunca o CPF completo: o relatório do CI também é log. */
  detalhe?: string;
}

/** `.xml` só em `test/` ou em alguma pasta `fixtures/`. */
export function xmlPermitido(caminho: string): boolean {
  const partes = caminho.replaceAll('\\', '/').split('/');
  if (!partes.at(-1)?.toLowerCase().endsWith('.xml')) return true;
  return partes[0] === 'test' || partes.slice(0, -1).includes('fixtures');
}

// 11 dígitos seguidos ou no formato 000.000.000-00, sem fazer parte de um número maior.
const CANDIDATO_CPF = /(?<![\d.-])(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?![\d-])/g;

export function checarArquivos(
  arquivos: readonly ArquivoVersionado[],
  cpfsPermitidos: ReadonlySet<string>,
): Problema[] {
  const problemas: Problema[] = [];
  for (const { caminho, conteudo } of arquivos) {
    if (!xmlPermitido(caminho)) problemas.push({ caminho, motivo: 'xml-fora-de-fixtures' });
    const linhas = conteudo.split('\n');
    linhas.forEach((texto, i) => {
      for (const m of texto.matchAll(CANDIDATO_CPF)) {
        const cpf = (m[1] ?? '').replace(/\D/g, '');
        if (cpfTemDvValido(cpf) && !cpfsPermitidos.has(cpf)) {
          problemas.push({
            caminho,
            linha: i + 1,
            motivo: 'cpf-valido',
            detalhe: mascararCpf(cpf),
          });
        }
      }
    });
  }
  return problemas;
}
