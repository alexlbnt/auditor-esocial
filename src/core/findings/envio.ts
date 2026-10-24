import { mascararCpf } from './cpf.ts';
import { sanearTexto } from './sanear.ts';
import type { Achado, Severidade } from './tipos.ts';

/** Achado como pode sair do navegador (para a API): nada com 11 dígitos seguidos. */
export interface AchadoParaEnvio {
  regra: string;
  regraVersao: number;
  severidade: Severidade;
  chave: string;
  cpfMascarado?: string;
  matricula?: string;
  evento: string;
  eventoId: string;
  arquivo: string;
  campo?: string;
  valores: Record<string, string | number>;
  causa?: string;
}

const ONZE_DIGITOS = /\d{11}/;

/**
 * CPF mascarado; nome de arquivo, Id do evento, matrícula, causa e textos dos
 * valores saneados. Números (centavos) passam como estão, a não ser que tenham
 * 11 dígitos ou mais: aí viram texto saneado. A última trava é conferir o JSON.
 */
export function paraEnvio(achado: Achado): AchadoParaEnvio {
  const valores: Record<string, string | number> = {};
  for (const [nome, valor] of Object.entries(achado.valores ?? {})) {
    valores[sanearTexto(nome)] =
      typeof valor === 'number' && !ONZE_DIGITOS.test(String(valor))
        ? valor
        : sanearTexto(String(valor));
  }
  const saida: AchadoParaEnvio = {
    regra: achado.regra,
    regraVersao: achado.regraVersao,
    severidade: achado.severidade,
    chave: achado.chave,
    ...(achado.cpf ? { cpfMascarado: mascararCpf(achado.cpf) } : {}),
    ...(achado.matricula ? { matricula: sanearTexto(achado.matricula) } : {}),
    evento: achado.evento,
    eventoId: sanearTexto(achado.eventoId),
    arquivo: sanearTexto(achado.arquivo),
    ...(achado.campo ? { campo: sanearTexto(achado.campo) } : {}),
    valores,
    ...(achado.causa ? { causa: sanearTexto(achado.causa) } : {}),
  };
  if (ONZE_DIGITOS.test(JSON.stringify(saida))) {
    throw new Error('Achado com 11 dígitos seguidos não pode sair do navegador');
  }
  return saida;
}
