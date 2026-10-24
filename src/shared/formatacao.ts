// Formatação para a tela. Dinheiro só com aritmética de inteiros (D-06): nada de
// dividir centavos por 100 em ponto flutuante.

const milhar = (inteiro: string) => inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 282000 -> "R$ 2.820,00"; -6000 -> "-R$ 60,00". */
export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const reais = String(Math.floor(absoluto / 100));
  const resto = String(absoluto % 100).padStart(2, '0');
  return `${sinal}R$ ${milhar(reais)},${resto}`;
}

/** 10350 -> "10.350". */
export const formatarQuantidade = (n: number) => milhar(String(n));

/** "2026-09" -> "09/2026"; "2026" -> "13º de 2026". */
export function formatarCompetencia(competencia: string): string {
  if (competencia.length === 4) return `13º de ${competencia}`;
  const [ano, mes] = competencia.split('-');
  return `${mes}/${ano}`;
}
