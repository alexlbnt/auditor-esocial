import { base32Letras, hmacSha256 } from './hmac.ts';

export interface PartesDaChave {
  regra: string;
  cpf?: string;
  campo?: string;
  competencia: string;
  discriminador?: string;
}

/**
 * Chave do achado = HMAC-SHA256(segredo da conta, regra + CPF + campo + competência
 * [+ discriminador]). Hash simples de CPF seria reversível por força bruta (só 11
 * dígitos); com o segredo fora do banco, não é. Sem login, o segredo é da sessão.
 */
export function chaveDoAchado(segredo: Uint8Array, partes: PartesDaChave): string {
  // \u001f (separador de unidade) não aparece em nenhum dos campos.
  const mensagem = [
    partes.regra,
    partes.cpf ?? '',
    partes.campo ?? '',
    partes.competencia,
    partes.discriminador ?? '',
  ].join('\u001f');
  return base32Letras(hmacSha256(segredo, new TextEncoder().encode(mensagem)));
}
