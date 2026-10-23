// Auditoria pelo terminal: npm run audit -- <pasta-ou-zip-ou-xml>
// Etapa 1.1: lê o lote e conta os eventos por tipo. Usa o mesmo core do navegador.
// Nada de conteúdo de XML na saída; nomes de arquivo saem saneados.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { sanearTexto } from '../src/core/findings/sanear.ts';
import { lerLote, type ArquivoEntrada } from '../src/core/ingest/index.ts';

function listar(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    return item.isDirectory() ? listar(caminho) : item.isFile() ? [caminho] : [];
  });
}

const alvo = process.argv[2];
if (!alvo) {
  console.error('Uso: npm run audit -- <pasta | arquivo.zip | arquivo.xml>');
  process.exit(2);
}

const inicio = performance.now();
const ehPasta = statSync(alvo).isDirectory();
const entradas: ArquivoEntrada[] = (ehPasta ? listar(alvo) : [alvo]).map((caminho) => ({
  nome: (ehPasta ? relative(alvo, caminho) : basename(caminho)).split(sep).join('/'),
  bytes: new Uint8Array(readFileSync(caminho)),
}));

const resultado = lerLote(entradas);
if (resultado.recusa) {
  const { limite, arquivo, valor, maximo } = resultado.recusa;
  const onde = arquivo ? ` (${sanearTexto(arquivo)})` : '';
  console.error(`Lote recusado pelo RNF-06: ${limite}${onde}: ${valor} > ${maximo}`);
  process.exit(1);
}

const contar = (chaves: string[]) =>
  [...chaves.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())].sort(
    ([a], [b]) => (a < b ? -1 : 1),
  );

console.log(`Arquivos de entrada: ${entradas.length}`);
console.log(`Eventos do MVP: ${resultado.eventos.length}`);
for (const [tipo, n] of contar(resultado.eventos.map((e) => e.tipo)))
  console.log(`  ${tipo}  ${n}`);

console.log(`Fora da auditoria: ${resultado.foraDaAuditoria.length}`);
for (const [motivo, n] of contar(resultado.foraDaAuditoria.map((f) => f.motivo))) {
  console.log(`  ${motivo}  ${n}`);
}
if (process.argv.includes('--detalhes')) {
  for (const f of resultado.foraDaAuditoria) {
    const posicao = f.posicaoNoLote ? `#${f.posicaoNoLote}` : '';
    console.log(
      `    ${sanearTexto(f.arquivo)}${posicao}  ${f.motivo}  ${sanearTexto(f.detalhe ?? '')}`,
    );
  }
}
console.log(`Tempo: ${Math.round(performance.now() - inicio)} ms`);
