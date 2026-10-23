/**
 * CPFs fictícios (DV válido) que podem aparecer em fixtures, testes e docs.
 * Qualquer outro CPF válido versionado faz o CI falhar (scripts/checar-dados-reais.ts).
 * Para incluir um novo: gere um CPF inventado, nunca use um de pessoa real.
 */
export const CPFS_FICTICIOS: ReadonlySet<string> = new Set([
  '52998224725', // test/fixtures/s1200-lote-anonimizado.xml
  '12345678909', // exemplo didático do cálculo do DV
]);
