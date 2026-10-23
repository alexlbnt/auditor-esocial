/**
 * Mascara sequências de 11 dígitos ou mais (possível CPF, CNPJ ou Id de evento)
 * em texto que sai do core: nome de arquivo, detalhe, linha de terminal.
 * 11 dígitos: `***456789**`, como a máscara do CPF. Mais longas: tudo em `*`.
 */
export function sanearTexto(texto: string): string {
  return texto.replace(/\d{11,}/g, (run) =>
    run.length === 11 ? `***${run.slice(3, 9)}**` : '*'.repeat(run.length),
  );
}
