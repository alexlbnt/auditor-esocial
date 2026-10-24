// Auditoria pelo terminal:
//   npm run audit -- <pasta-ou-zip-ou-xml> [--pacote AAAA-MM-DD] [--competencia AAAA-MM]
//                    [--saida <pasta>] [--detalhes]
// --saida grava achados.csv, fora-da-auditoria.csv e resumo.txt (CPF mascarado).
// --segredo-arquivo usa (ou cria) um segredo fixo, para a chave dos achados ser estável;
// --comparar <pasta> compara o achados.csv com o de uma linha de base (npm run audit:local).
// Usa o mesmo core/audit.ts do navegador. Nada de conteúdo de XML na saída:
// nomes de arquivo e mensagens do XSD saem saneados (sem 11 dígitos seguidos).
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { auditar } from '../src/core/audit.ts';
import { paraEnvio } from '../src/core/findings/envio.ts';
import { sanearTexto } from '../src/core/findings/sanear.ts';
import type { ArquivoEntrada } from '../src/core/ingest/index.ts';
import { TABELAS_S_1_3 } from '../src/core/leiaute/S-1.3/tabelas.ts';
import { totais } from '../src/core/model/totais.ts';
import { REGRAS } from '../src/core/rules/registry.ts';
import { criarValidadorLibxml2 } from '../src/core/xsd/libxml2.ts';
import { compararAchados } from './lib/comparar.ts';
import { csvDeAchados, csvForaDaAuditoria } from './lib/csv.ts';
import { carregarPacote, listarPacotes, RAIZ_PACOTES } from './lib/pacotes-xsd.ts';

function listar(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    if (item.name.startsWith('.')) return []; // .segredo, .resultado, .linha-de-base
    const caminho = join(pasta, item.name);
    return item.isDirectory() ? listar(caminho) : item.isFile() ? [caminho] : [];
  });
}

const { values: opcoes, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    pacote: { type: 'string' },
    competencia: { type: 'string' },
    saida: { type: 'string' },
    'segredo-arquivo': { type: 'string' },
    comparar: { type: 'string' },
    detalhes: { type: 'boolean', default: false },
  },
});
const alvo = positionals[0];
if (!alvo) {
  console.error(
    'Uso: npm run audit -- <pasta | arquivo.zip | arquivo.xml> [--pacote AAAA-MM-DD] [--competencia AAAA-MM] [--saida <pasta>] [--detalhes]',
  );
  process.exit(2);
}

/** Sem conta, o segredo é da sessão; com --segredo-arquivo, fica salvo (só local). */
function segredo(): Uint8Array {
  const arquivo = opcoes['segredo-arquivo'];
  if (!arquivo) return new Uint8Array(randomBytes(32));
  if (!existsSync(arquivo)) writeFileSync(arquivo, randomBytes(32).toString('base64'));
  return new Uint8Array(Buffer.from(readFileSync(arquivo, 'utf8').trim(), 'base64'));
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
    // Segredo da sessão: sem conta, a chave dos achados vale só nesta execução.
    segredo: segredo(),
    relogio: () => performance.now(),
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
  for (const [fonte, n] of contar(demonstrativos.map((d) => d.fonte))) {
    console.log(`    ${fonte}  ${n}`);
  }
  const pessoas = [...auditoria.pessoas.values()];
  console.log(`  pagamentos (S-1210)  ${pessoas.reduce((n, p) => n + p.pagamentos.length, 0)}`);
  console.log(
    `  desligamentos (S-2299)  ${pessoas.reduce((n, p) => n + p.desligamentos.length, 0)}`,
  );
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

const { motor } = resultado;
if (motor) {
  console.log(`Achados: ${motor.achados.length} (regras em ${Math.round(motor.duracaoMs)} ms)`);
  const porRegra = contar(motor.achados.map((a) => `${a.regra} ${a.severidade}`));
  for (const [chave, n] of porRegra) console.log(`  ${chave}  ${n}`);
  const executadas = motor.regrasExecutadas.map((r) => `${r.codigo}@${r.versao}`).join(', ');
  console.log(`  regras executadas: ${executadas || 'nenhuma'}`);
  for (const n of motor.naoExecutadas) {
    console.log(`  ${n.codigo} não executada: ${n.motivo}${n.erro ? ` (${n.erro})` : ''}`);
  }
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
const tempoTotal = Math.round(performance.now() - inicio);
const tempos = resultado.tempos
  ? Object.entries(resultado.tempos)
      .map(([etapa, ms]) => `${etapa} ${Math.round(ms)}`)
      .join(' · ')
  : '';
console.log(`Tempo: ${tempoTotal} ms (${tempos}, leitura do disco fora)`);

if (opcoes.saida) {
  const pasta = opcoes.saida;
  mkdirSync(pasta, { recursive: true });
  const competencia = modelo.tipo === 'pronta' ? modelo.auditoria.competencia : '';
  const achados = (motor?.achados ?? []).map(paraEnvio);
  writeFileSync(join(pasta, 'achados.csv'), csvDeAchados(achados, REGRAS, competencia));
  writeFileSync(
    join(pasta, 'fora-da-auditoria.csv'),
    csvForaDaAuditoria(resultado.foraDaAuditoria, motor?.naoExecutadas ?? []),
  );
  const resumo = [
    `Pente Fino · audit-cli · ${new Date().toISOString()}`,
    `Arquivos de entrada: ${entradas.length}`,
    `Pacote XSD: ${resultado.pacoteXsd ?? 'não validado'}`,
    `Competência: ${competencia || modelo.tipo}`,
    `Eventos auditados: ${resultado.eventos.length}; reprovados no XSD: ${resultado.reprovados.length}; sem assinatura: ${resultado.semAssinatura}`,
    `Achados: ${achados.length}`,
    ...contar(achados.map((a) => `${a.regra} ${a.severidade}`)).map(([k, n]) => `  ${k}  ${n}`),
    `Fora da auditoria: ${resultado.foraDaAuditoria.length}`,
    `Regras executadas: ${(motor?.regrasExecutadas ?? []).map((r) => `${r.codigo}@${r.versao}`).join(', ')}`,
    `Tempo total: ${tempoTotal} ms (${tempos})`,
    '',
  ].join('\n');
  writeFileSync(join(pasta, 'resumo.txt'), resumo);
  console.log(`Saída gravada em ${pasta}/ (achados.csv, fora-da-auditoria.csv, resumo.txt)`);

  const base = opcoes.comparar ? join(opcoes.comparar, 'achados.csv') : undefined;
  if (base && existsSync(base)) {
    const c = compararAchados(
      readFileSync(base, 'utf8'),
      readFileSync(join(pasta, 'achados.csv'), 'utf8'),
    );
    console.log(
      `Comparação com ${opcoes.comparar}/: ${c.novos.length} novo(s), ${c.resolvidos.length} resolvido(s), ${c.mudaram.length} mudaram, ${c.iguais} iguais`,
    );
    const mostrar = (rotulo: string, linhas: string[]) => {
      for (const l of linhas.slice(0, 20)) console.log(`  ${rotulo} ${l}`);
      if (linhas.length > 20) console.log(`  ${rotulo} ... e mais ${linhas.length - 20}`);
    };
    mostrar('+', c.novos);
    mostrar('-', c.resolvidos);
    mostrar('~', c.mudaram);
    if (c.novos.length + c.resolvidos.length + c.mudaram.length > 0) process.exitCode = 1;
  } else if (base) {
    console.log(
      `Sem linha de base em ${opcoes.comparar}/: para criar, copie ${pasta}/ para lá depois de revisar.`,
    );
  }
}
