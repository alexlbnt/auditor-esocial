const ZERO = 48; // código do caractere '0'

function digitos(texto: string): number[] | undefined {
  if (!/^\d{11}$/.test(texto)) return undefined;
  return Array.from(texto, (c) => c.charCodeAt(0) - ZERO);
}

function dv(base: readonly number[]): number {
  const pesoInicial = base.length + 1;
  const soma = base.reduce((s, d, i) => s + d * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Módulo 11 dos dois dígitos verificadores; recusa os 11 dígitos iguais. */
export function cpfTemDvValido(cpf: string): boolean {
  const d = digitos(cpf);
  if (!d) return false;
  if (d.every((x) => x === d[0])) return false;
  const dv1 = dv(d.slice(0, 9));
  const dv2 = dv([...d.slice(0, 9), dv1]);
  return d[9] === dv1 && d[10] === dv2;
}

/** Máscara usada em tudo que sai do navegador: `***.456.789-**`. */
export function mascararCpf(cpf: string): string {
  if (!/^\d{11}$/.test(cpf)) return '***.***.***-**';
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
