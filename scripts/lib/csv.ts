// CSV do audit-cli (Fase 0: revisão do Alex e pilotos). Excel em português: `;` como
// separador, vírgula decimal, BOM para os acentos. Tudo passa por paraEnvio():
// CPF mascarado e nada com 11 dígitos seguidos, porque o CSV pode ir para piloto.
import type { AchadoParaEnvio } from '../../src/core/findings/envio.ts';
import type { ItemFora } from '../../src/core/ingest/tipos.ts';
import { sanearTexto } from '../../src/core/findings/sanear.ts';
import type { Regra, RegraNaoExecutada } from '../../src/core/rules/tipos.ts';

const BOM = '\uFEFF';
const FIM_DE_LINHA = '\r\n';

/** Centavos -> `2820,00` (sem separador de milhar, para o Excel ler como número). */
export function formatarCentavos(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const reais = Math.floor(absoluto / 100);
  return `${sinal}${reais},${String(absoluto % 100).padStart(2, '0')}`;
}

/** Texto vindo do XML não pode virar fórmula no Excel (=, +, -, @, tab, CR). */
function protegerFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function celula(valor: string | number | undefined, tipo: 'texto' | 'dinheiro' = 'texto'): string {
  if (valor === undefined || valor === '') return '';
  const texto =
    typeof valor === 'number' && tipo === 'dinheiro'
      ? formatarCentavos(valor)
      : protegerFormula(String(valor));
  return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

const linha = (celulas: string[]) => celulas.join(';');
const arquivoCsv = (linhas: string[]) => BOM + linhas.join(FIM_DE_LINHA) + FIM_DE_LINHA;

const DINHEIRO_EM_COLUNA = ['esperado', 'encontrado', 'diferenca'] as const;

export function csvDeAchados(
  achados: readonly AchadoParaEnvio[],
  regras: readonly Regra[],
  competencia: string,
): string {
  const titulo = new Map(regras.map((r) => [r.codigo, r.titulo]));
  const cabecalho = [
    'severidade', 'regra', 'versao', 'titulo', 'cpf', 'matricula', 'competencia', 'evento', 'arquivo',
    'campo', 'esperado', 'encontrado', 'diferenca', 'causa', 'detalhes', 'chave',
  ]; // prettier-ignore
  const linhas = achados.map((a) => {
    const v = a.valores;
    const dinheiro = (nome: (typeof DINHEIRO_EM_COLUNA)[number]) => {
      const x = v[nome];
      return typeof x === 'number' ? celula(x, 'dinheiro') : celula(x);
    };
    const detalhes = Object.entries(v)
      .filter(([nome]) => !(DINHEIRO_EM_COLUNA as readonly string[]).includes(nome))
      .map(([nome, x]) => `${nome}=${typeof x === 'number' ? formatarCentavos(x) : x}`)
      .join(' | ');
    return linha([
      celula(a.severidade),
      celula(a.regra),
      celula(String(a.regraVersao)),
      celula(titulo.get(a.regra)),
      celula(a.cpfMascarado),
      celula(a.matricula),
      celula(competencia),
      celula(a.evento),
      celula(a.arquivo),
      celula(a.campo),
      dinheiro('esperado'),
      dinheiro('encontrado'),
      dinheiro('diferenca'),
      celula(a.causa),
      celula(detalhes),
      celula(a.chave),
    ]);
  });
  return arquivoCsv([linha(cabecalho), ...linhas]);
}

export function csvForaDaAuditoria(
  fora: readonly ItemFora[],
  naoExecutadas: readonly RegraNaoExecutada[],
): string {
  const linhas = [
    ...fora.map((f) =>
      linha([
        'entrada',
        celula(sanearTexto(f.arquivo)),
        celula(f.posicaoNoLote === undefined ? undefined : String(f.posicaoNoLote)),
        celula(f.motivo),
        celula(sanearTexto(f.detalhe ?? '')),
      ]),
    ),
    ...naoExecutadas.map((n) =>
      linha([
        'regra',
        '',
        '',
        celula(`${n.codigo}@${n.versao} não executada: ${n.motivo}`),
        celula(n.erro),
      ]),
    ),
  ];
  return arquivoCsv([linha(['tipo', 'arquivo', 'posicao', 'motivo', 'detalhe']), ...linhas]);
}
