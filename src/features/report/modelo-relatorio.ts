// Lógica do relatório (HU-02), sem React: agrupar por trabalhador, ordenar pela maior
// severidade, filtrar e escolher o "Comece por aqui". Testada em modelo-relatorio.test.ts.
import { mascararCpf } from '@/core/findings/cpf';
import { GRAVIDADE, type Achado, type Severidade } from '@/core/findings/tipos';
import type { TrabalhadorNaTela } from '@/workers/resumo';

/** Achados sem CPF (R001, R009, avisos do lote) ficam neste grupo. */
export const GRUPO_DO_LOTE = 'lote';

export interface Grupo {
  /** CPF (só em memória) ou GRUPO_DO_LOTE. */
  id: string;
  rotulo: string;
  matriculas: string[];
  pior: Severidade;
  achados: Achado[];
}

export type Linha =
  | { tipo: 'grupo'; grupo: Grupo; visiveis: number }
  | { tipo: 'achado'; achado: Achado; grupo: Grupo };

const pior = (achados: readonly Achado[]): Severidade =>
  achados.reduce<Severidade>(
    (p, a) => (GRAVIDADE[a.severidade] < GRAVIDADE[p] ? a.severidade : p),
    'info',
  );

const porGravidade = (a: Achado, b: Achado) =>
  GRAVIDADE[a.severidade] - GRAVIDADE[b.severidade] ||
  (a.regra < b.regra ? -1 : a.regra > b.regra ? 1 : 0);

/**
 * Um grupo por trabalhador com achado, mais o do lote. Ordem: pior severidade,
 * depois quantidade de achados, depois CPF (estável).
 */
export function agruparPorTrabalhador(
  achados: readonly Achado[],
  trabalhadores: readonly TrabalhadorNaTela[],
): Grupo[] {
  const matriculas = new Map(trabalhadores.map((t) => [t.cpf, t.matriculas]));
  const porCpf = new Map<string, Achado[]>();
  for (const a of achados) {
    const id = a.cpf ?? GRUPO_DO_LOTE;
    const lista = porCpf.get(id);
    if (lista) lista.push(a);
    else porCpf.set(id, [a]);
  }
  const grupos: Grupo[] = [...porCpf].map(([id, lista]) => ({
    id,
    rotulo: id === GRUPO_DO_LOTE ? 'Lote e cadastros' : mascararCpf(id),
    matriculas: id === GRUPO_DO_LOTE ? [] : (matriculas.get(id) ?? []),
    pior: pior(lista),
    achados: [...lista].sort(porGravidade),
  }));
  return grupos.sort(
    (a, b) =>
      GRAVIDADE[a.pior] - GRAVIDADE[b.pior] ||
      b.achados.length - a.achados.length ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export interface Filtro {
  severidades: ReadonlySet<Severidade>;
  /** CPF (com ou sem pontuação), matrícula ou código da regra. */
  busca: string;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');

function grupoCombina(g: Grupo, termo: string, digitos: string): boolean {
  if (!termo) return true;
  if (digitos.length >= 3 && g.id !== GRUPO_DO_LOTE && g.id.includes(digitos)) return true;
  return g.matriculas.some((m) => m.toLowerCase().includes(termo));
}

/** Linhas da lista virtualizada: cabeçalho do grupo e seus achados que passam no filtro. */
export function linhasFiltradas(grupos: readonly Grupo[], { severidades, busca }: Filtro): Linha[] {
  const termo = busca.trim().toLowerCase();
  const digitos = soDigitos(termo);
  const ehRegra = /^r\d{1,3}$/.test(termo);
  const linhas: Linha[] = [];
  for (const grupo of grupos) {
    const combinaGrupo = ehRegra || grupoCombina(grupo, termo, digitos);
    if (!combinaGrupo) continue;
    const visiveis = grupo.achados.filter(
      (a) => severidades.has(a.severidade) && (!ehRegra || a.regra.toLowerCase().startsWith(termo)),
    );
    if (visiveis.length === 0) continue;
    linhas.push({ tipo: 'grupo', grupo, visiveis: visiveis.length });
    for (const achado of visiveis) linhas.push({ tipo: 'achado', achado, grupo });
  }
  return linhas;
}

export type ComecePorAqui =
  | { tipo: 'causa'; causa: string; quantidade: number; regra: string }
  | { tipo: 'regra'; regra: string; quantidade: number; severidade: Severidade }
  | undefined;

/**
 * A correção que mais resolve: a causa com mais achados (empate: a mais grave);
 * sem causa, a regra com mais achados da maior severidade. Só aparece se resolve
 * 2 achados ou mais.
 */
export function comecePorAqui(achados: readonly Achado[]): ComecePorAqui {
  const causas = new Map<string, Achado[]>();
  for (const a of achados) {
    if (!a.causa) continue;
    const lista = causas.get(a.causa);
    if (lista) lista.push(a);
    else causas.set(a.causa, [a]);
  }
  const melhorCausa = [...causas].sort(
    ([ca, a], [cb, b]) =>
      b.length - a.length || GRAVIDADE[pior(a)] - GRAVIDADE[pior(b)] || (ca < cb ? -1 : 1),
  )[0];
  if (melhorCausa && melhorCausa[1].length > 1) {
    const [causa, lista] = melhorCausa;
    return { tipo: 'causa', causa, quantidade: lista.length, regra: lista[0]?.regra ?? '' };
  }
  const piorSeveridade = pior(achados);
  const daSeveridade = achados.filter((a) => a.severidade === piorSeveridade);
  const porRegra = new Map<string, number>();
  for (const a of daSeveridade) porRegra.set(a.regra, (porRegra.get(a.regra) ?? 0) + 1);
  const [regra, quantidade] =
    [...porRegra].sort(([ra, a], [rb, b]) => b - a || (ra < rb ? -1 : 1))[0] ?? [];
  // Uma correção que resolve um achado só não é conselho: sem cartão.
  return regra && quantidade && quantidade > 1
    ? { tipo: 'regra', regra, quantidade, severidade: piorSeveridade }
    : undefined;
}
