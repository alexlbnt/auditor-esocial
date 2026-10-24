// Regressão com XMLs reais (nível 5): compara o achados.csv de agora com o da linha de
// base pela coluna `chave` (estável porque o segredo local fica em local-data/.segredo).

export interface Comparacao {
  novos: string[];
  resolvidos: string[];
  mudaram: string[];
  iguais: number;
}

function porChave(csv: string): Map<string, string> {
  const [cabecalho = '', ...linhas] = csv.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const coluna = cabecalho.split(';').indexOf('chave');
  if (coluna < 0) throw new Error('achados.csv sem a coluna chave');
  // A chave é a última coluna e nunca tem ; nem aspas (só letras).
  return new Map(linhas.map((l) => [l.slice(l.lastIndexOf(';') + 1), l]));
}

export function compararAchados(base: string, atual: string): Comparacao {
  const antes = porChave(base);
  const agora = porChave(atual);
  const resultado: Comparacao = { novos: [], resolvidos: [], mudaram: [], iguais: 0 };
  for (const [chave, linha] of agora) {
    const anterior = antes.get(chave);
    if (anterior === undefined) resultado.novos.push(linha);
    else if (anterior !== linha) resultado.mudaram.push(linha);
    else resultado.iguais += 1;
  }
  for (const [chave, linha] of antes) if (!agora.has(chave)) resultado.resolvidos.push(linha);
  return resultado;
}
