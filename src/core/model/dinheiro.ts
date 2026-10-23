/** Dinheiro em centavos inteiros. Nunca ponto flutuante (D-06). */
export type Centavos = number;

/** Texto que não é um valor monetário do leiaute. */
export class ValorMonetarioInvalido extends Error {}

// Formato do XSD (TS_valorMonetario, TS_vrRubr): ponto decimal, até 2 casas.
const VALOR = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Converte o texto do XML direto para centavos: `"1234.56"` -> `123456`.
 * Recusa vírgula, vazio, espaço, mais de 2 casas e valor fora do inteiro seguro.
 */
export function paraCentavos(texto: string): Centavos {
  const m = VALOR.exec(texto);
  if (!m?.[2]) throw new ValorMonetarioInvalido(`Valor monetário inválido: "${texto}"`);
  const digitos = m[2] + (m[3] ?? '').padEnd(2, '0');
  const centavos = parseInt(digitos, 10);
  if (!Number.isSafeInteger(centavos))
    throw new ValorMonetarioInvalido(`Valor monetário fora do limite: "${texto}"`);
  if (centavos === 0) return 0; // sem -0
  return m[1] ? -centavos : centavos;
}
