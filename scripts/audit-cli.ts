// Auditoria pelo terminal: npm run audit -- <pasta-ou-zip-ou-xml> [--pacote AAAA-MM-DD] [--competencia AAAA-MM] [--detalhes]
// Usa o mesmo core/audit.ts do navegador. Nada de conteúdo de XML na saída:
// nomes de arquivo e mensagens do XSD saem saneados (sem 11 dígitos seguidos).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { auditar } from '../src/core/audit.ts';
import { sanearTexto } from '../src/core/findings/sanear.ts';
import type { ArquivoEntrada } from '../src/core/ingest/index.ts';
import { TABELAS_S_1_3 } from '../src/core/leiaute/S-1.3/tabelas.ts';
import { totais } from '../src/core/model/totais.ts';
import { criarValidadorLibxml2 } from '../src/core/xsd/libxml2.ts';
import { carregarPacote, listarPacotes, RAIZ_PACOTES } from './lib/pacotes-xsd.ts';

function listar(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    return item.isDirectory() ? listar(caminho) : item.isFile() ? [caminho] : [];
  });
}

const { values: opcoes, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    pacote: { type: 'string' },
    competencia: { type: 'string' },
    detalhes: { type: 'boolean', default: false },
  },
});
const alvo = positionals[0];
if (!alvo) {
  console.error(
    'Uso: npm run audit -- <pasta | arquivo.zip | arquivo.xml> [--pacote AAAA-MM-DD] [--detalhes]',
  );
  process.exit(2);
}

const pacotes = listarPacotes();
if (opcoes.pacote && !pacotes.includes(opcoes.pacote)) {
  const ha = pacotes.join(', ') || 'nenhum';
  console.error(`Pacote ${opcoes.pacote} não encontrado em ${RAIZ_PACOTES}/ (há: ${ha})`);
  process.exit(2);
}
// D-09 em aberto: sem --pacote, usa o mais recente disponível.
const dataPacote = opcoes.pacote ?? pacotes.at(-1);

const inicio = performance.now();
const ehPasta = statSync(alvo).isDirectory();
const entradas: ArquivoEntrada[] = (ehPasta ? listar(alvo) : [alvo]).map((caminho) => ({
  nome: (ehPasta ? relative(alvo, caminho) : basename(caminho)).split(sep).join('/'),
  bytes: new Uint8Array(readFileSync(caminho)),
}));

const validador = dataPacote ? criarValidadorLibxml2(carregarPacote(dataPacote)) : undefined;
let resultado;
try {
  resultado = auditar(entradas, {
    ...(validador ? { validador } : {}),
    ...(opcoes.competencia ? { competencia: opcoes.competencia } : {}),
  });
} finally {
  validador?.dispose();
}

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
const lugar = (arquivo: string, posicao?: number) =>
  `${sanearTexto(arquivo)}${posicao ? `#${posicao}` : ''}`;

console.log(`Arquivos de entrada: ${entradas.length}`);
if (resultado.xsd === 'validado') {
  console.log(`XSD: pacote ${resultado.pacoteXsd}`);
} else {
  console.log(`XSD: NÃO VALIDADO (nenhum pacote em ${RAIZ_PACOTES}/). A R001 não rodou.`);
}

console.log(`Eventos que seguem para a auditoria: ${resultado.eventos.length}`);
for (const [tipo, n] of contar(resultado.eventos.map((e) => e.tipo)))
  console.log(`  ${tipo}  ${n}`);

console.log(`Reprovados no XSD (R001): ${resultado.reprovados.length}`);
for (const [tipo, n] of contar(resultado.reprovados.map((r) => r.evento.tipo))) {
  console.log(`  ${tipo}  ${n}`);
}
if (resultado.semAssinatura > 0) {
  console.log(
    `Aviso: ${resultado.semAssinatura} evento(s) sem assinatura digital, validados sem ela (D-08).`,
  );
}

const { modelo } = resultado;
if (modelo.tipo === 'pronta') {
  const { auditoria } = modelo;
  const demonstrativos = [...auditoria.pessoas.values()].flatMap((p) => p.demonstrativos);
  const semCadastro = demonstrativos.filter(
    (d) => totais(d, auditoria.rubricas, TABELAS_S_1_3).rubricasSemCadastro.length > 0,
  ).length;
  console.log(`Modelo: competência ${auditoria.competencia} (${auditoria.apuracao})`);
  console.log(`  trabalhadores  ${auditoria.pessoas.size}`);
  console.log(`  demonstrativos  ${demonstrativos.length} (${semCadastro} com rubrica sem S-1010)`);
  console.log(`  rubricas válidas na competência  ${auditoria.rubricas.size}`);
} else if (modelo.tipo === 'escolher-competencia') {
  const lista = modelo.competencias.join(', ');
  console.log(`Modelo: o lote tem mais de uma competência (${lista}). Use --competencia.`);
} else if (modelo.tipo === 'varios-empregadores') {
  const lista = modelo.raizes.map(sanearTexto).join(', ');
  console.log(`Modelo: mais de um empregador no lote (${lista}).`);
} else {
  console.log('Modelo: nenhum S-1200 para montar.');
}

console.log(`Fora da auditoria: ${resultado.foraDaAuditoria.length}`);
for (const [motivo, n] of contar(resultado.foraDaAuditoria.map((f) => f.motivo))) {
  console.log(`  ${motivo}  ${n}`);
}

if (opcoes.detalhes) {
  for (const { evento, erros, total } of resultado.reprovados) {
    const onde = lugar(evento.arquivo, evento.posicaoNoLote);
    console.log(`  R001 ${onde} (${evento.tipo}): ${total} erro(s)`);
    for (const e of erros) console.log(`    linha ${e.linha}: ${sanearTexto(e.mensagem)}`);
  }
  for (const f of resultado.foraDaAuditoria) {
    const detalhe = sanearTexto(f.detalhe ?? '');
    console.log(`  ${lugar(f.arquivo, f.posicaoNoLote)}  ${f.motivo}  ${detalhe}`);
  }
}
console.log(`Tempo: ${Math.round(performance.now() - inicio)} ms`);
