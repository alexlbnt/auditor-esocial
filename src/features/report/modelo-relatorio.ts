// Lógica do relatório (HU-02 e HU-04), sem React: agrupar por trabalhador, por regra ou
// por causa, ordenar pela maior severidade, filtrar e escolher o "Comece por aqui". Testada em modelo-relatorio.test.ts.
import { mascararCpf } from '@/core/findings/cpf';
import { GRAVIDADE, type Achado, type Severidade } from '@/core/findings/tipos';
import type { TrabalhadorNaTela } from '@/workers/resumo';

/** Achados sem CPF (R001, R009, avisos do lote) ficam neste grupo. */
export const GRUPO_DO_LOTE = 'lote';

export interface Grupo {
  /** CPF (só em memória), código da regra, causa, GRUPO_DO_LOTE ou GRUPO_SEM_CAUSA. */
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

/** Visões do relatório (HU-02 e HU-04). */
export type Visao = 'trabalhador' | 'regra' | 'causa';

/** Achados sem causa comum, na visão por causa. */
export const GRUPO_SEM_CAUSA = 'sem-causa';

function agrupar(achados: readonly Achado[], chave: (a: Achado) => string): Map<string, Achado[]> {
  const grupos = new Map<string, Achado[]>();
  for (const a of achados) {
    const id = chave(a);
    const lista = grupos.get(id);
    if (lista) lista.push(a);
    else grupos.set(id, [a]);
  }
  return grupos;
}

const ordenarGrupos = (grupos: Grupo[]) =>
  grupos.sort(
    (a, b) =>
      GRAVIDADE[a.pior] - GRAVIDADE[b.pior] ||
      b.achados.length - a.achados.length ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

/**
 * Um grupo por trabalhador com achado, mais o do lote. Ordem: pior severidade,
 * depois quantidade de achados, depois CPF (estável).
 */
export function agruparPorTrabalhador(
  achados: readonly Achado[],
  trabalhadores: readonly TrabalhadorNaTela[],
): Grupo[] {
  const matriculas = new Map(trabalhadores.map((t) => [t.cpf, t.matriculas]));
  const grupos = [...agrupar(achados, (a) => a.cpf ?? GRUPO_DO_LOTE)].map(([id, lista]) => ({
    id,
    rotulo: id === GRUPO_DO_LOTE ? 'Lote e cadastros' : mascararCpf(id),
    matriculas: id === GRUPO_DO_LOTE ? [] : (matriculas.get(id) ?? []),
    pior: pior(lista),
    achados: [...lista].sort(porGravidade),
  }));
  return ordenarGrupos(grupos);
}

/** HU-04: uma linha por regra, com a quantidade de achados (pior severidade primeiro). */
export function agruparPorRegra(
  achados: readonly Achado[],
  titulo: (codigo: string) => string,
): Grupo[] {
  const grupos = [...agrupar(achados, (a) => a.regra)].map(([codigo, lista]) => ({
    id: codigo,
    rotulo: `${codigo} · ${titulo(codigo)}`,
    matriculas: [],
    pior: pior(lista),
    achados: [...lista].sort(porGravidade),
  }));
  return ordenarGrupos(grupos);
}

/**
 * HU-04: achados que se resolvem com uma correção só (mesma `causa`), da causa que
 * mais resolve para a que menos resolve. Os sem causa comum vão para um grupo no fim.
 */
export function agruparPorCausa(
  achados: readonly Achado[],
  rotularCausa: (causa: string) => string,
): Grupo[] {
  const porCausa = agrupar(achados, (a) => a.causa ?? GRUPO_SEM_CAUSA);
  const semCausa = porCausa.get(GRUPO_SEM_CAUSA);
  porCausa.delete(GRUPO_SEM_CAUSA);
  const grupos: Grupo[] = [...porCausa]
    .map(([causa, lista]) => ({
      id: causa,
      rotulo: rotularCausa(causa),
      matriculas: [],
      pior: pior(lista),
      achados: [...lista].sort(porGravidade),
    }))
    .sort(
      (a, b) =>
        b.achados.length - a.achados.length ||
        GRAVIDADE[a.pior] - GRAVIDADE[b.pior] ||
        (a.id < b.id ? -1 : 1),
    );
  if (semCausa) {
    grupos.push({
      id: GRUPO_SEM_CAUSA,
      rotulo: 'Achados sem causa comum',
      matriculas: [],
      pior: pior(semCausa),
      achados: [...semCausa].sort(porGravidade),
    });
  }
  return grupos;
}

export interface Filtro {
  severidades: ReadonlySet<Severidade>;
  /** CPF (com ou sem pontuação), matrícula ou código da regra. */
  busca: string;
}

const soDigitos = (s: string) => s.replace(/\D/g, '');

/**
 * A busca olha cada achado (não só o grupo), para valer nas três visões: regra pelo
 * código; CPF a partir de 3 dígitos; matrícula do achado ou do trabalhador do grupo.
 */
function combina(
  a: Achado,
  grupo: Grupo,
  termo: string,
  digitos: string,
  ehRegra: boolean,
): boolean {
  if (!termo) return true;
  if (ehRegra) return a.regra.toLowerCase().startsWith(termo);
  if (digitos.length >= 3 && a.cpf?.includes(digitos)) return true;
  if (a.matricula?.toLowerCase().includes(termo)) return true;
  return grupo.matriculas.some((m) => m.toLowerCase().includes(termo));
}

/** Linhas da lista virtualizada: cabeçalho do grupo e seus achados que passam no filtro. */
export function linhasFiltradas(grupos: readonly Grupo[], { severidades, busca }: Filtro): Linha[] {
  const termo = busca.trim().toLowerCase();
  const digitos = soDigitos(termo);
  const ehRegra = /^r\d{1,3}$/.test(termo);
  const linhas: Linha[] = [];
  for (const grupo of grupos) {
    const visiveis = grupo.achados.filter(
      (a) => severidades.has(a.severidade) && combina(a, grupo, termo, digitos, ehRegra),
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
