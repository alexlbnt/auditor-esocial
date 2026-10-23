// Falha se o repositório tiver XML fora de fixtures/ ou test/, ou CPF válido
// fora da lista de fictícios. Roda com o TypeScript nativo do Node (22.18+).
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { CPFS_FICTICIOS } from './lib/cpfs-ficticios.ts';
import { checarArquivos, type ArquivoVersionado } from './lib/dados-reais.ts';

const LIMITE_BYTES = 20 * 1024 * 1024;

// Versionados e novos ainda não ignorados: pega o problema antes do commit.
const caminhos = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

const arquivos: ArquivoVersionado[] = [];
for (const caminho of caminhos) {
  let tamanho: number;
  try {
    tamanho = statSync(caminho).size;
  } catch {
    continue; // removido do disco, ainda no índice
  }
  if (tamanho > LIMITE_BYTES) {
    console.error(`Arquivo grande demais para checar: ${caminho}`);
    process.exit(1);
  }
  const conteudo = readFileSync(caminho, 'utf8');
  if (conteudo.includes('\0')) continue; // binário
  arquivos.push({ caminho, conteudo });
}

const problemas = checarArquivos(arquivos, CPFS_FICTICIOS);
for (const p of problemas) {
  const onde = p.linha ? `${p.caminho}:${p.linha}` : p.caminho;
  const texto =
    p.motivo === 'cpf-valido'
      ? `CPF válido fora da lista de fictícios (${p.detalhe})`
      : 'XML fora de fixtures/ ou test/';
  console.error(`${onde}  ${texto}`);
}
if (problemas.length > 0) {
  console.error(
    `\n${problemas.length} problema(s). Veja CLAUDE.md: dado real nunca entra no repositório.`,
  );
  process.exit(1);
}
console.log(`Dados reais: ${arquivos.length} arquivos checados, nenhum problema.`);
