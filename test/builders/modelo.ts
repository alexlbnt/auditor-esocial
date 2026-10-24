// Construtor do modelo canônico sem XML (testes de nível 1):
// umaAuditoria().comRubrica('1', 'provento').comPessoa(cpf, (p) => p.comDemonstrativo('A', [['1', 100_00]])).construir()
import {
  chaveRubrica,
  type Auditoria,
  type Centavos,
  type Demonstrativo,
  type EventoFonte,
  type FonteDemonstrativo,
  type Origem,
  type Pessoa,
  type Rubrica,
} from '../../src/core/model/tipos.ts';

const TIPO = { provento: '1', desconto: '2', informativa: '3', informativaDedutora: '4' } as const;

export const umaOrigem = (eventoId = 'ID-TESTE', tipo: Origem['tipo'] = 'S-1200'): Origem => ({
  arquivo: 'teste.xml',
  posicaoNoLote: 1,
  eventoId,
  tipo,
});

/** [codRubr, valor em centavos] ou [codRubr, valor, ideTabRubr] */
export type ItemCurto = [string, Centavos] | [string, Centavos, string];

export function umDemonstrativo(
  id: string,
  itens: readonly ItemCurto[],
  {
    fonte = 'RGPS',
    matricula = '0001',
    competencia = '2026-09',
  }: { fonte?: FonteDemonstrativo; matricula?: string; competencia?: string } = {},
): Demonstrativo {
  return {
    id,
    fonte,
    categoria: '101',
    periodoReferencia: competencia,
    grupos: [
      {
        estabelecimento: '11222333000181',
        lotacao: 'LOT001',
        matricula,
        itens: itens.map(([codigo, valor, tabela = '001']) => ({
          rubrica: chaveRubrica(codigo, tabela),
          valor,
          origem: umaOrigem(),
        })),
      },
    ],
    origem: umaOrigem(),
  };
}

class PessoaBuilder {
  readonly pessoa: Pessoa;
  constructor(cpf: string) {
    this.pessoa = { cpf, vinculos: [], demonstrativos: [], pagamentos: [], desligamentos: [] };
  }
  comDemonstrativo(
    id: string,
    itens: readonly ItemCurto[],
    opcoes?: Parameters<typeof umDemonstrativo>[2],
  ): this {
    this.pessoa.demonstrativos.push(umDemonstrativo(id, itens, opcoes));
    return this;
  }
  /** Pagamento do S-1210 (tpPgto 1 = S-1200, 2 = S-2299...). */
  comPagamento(
    demonstrativoId: string,
    liquido: Centavos,
    { tipoPagamento = '1', periodoReferencia = '2026-09', data = '2026-10-05' } = {},
  ): this {
    this.pessoa.pagamentos.push({
      data,
      periodoReferencia,
      demonstrativoId,
      tipoPagamento,
      liquido,
      origem: umaOrigem(`ID-S1210-${demonstrativoId}`, 'S-1210'),
    });
    return this;
  }
  comDesligamento(matricula: string, data: string): this {
    this.pessoa.desligamentos.push({ matricula, data, origem: umaOrigem('ID-S2299', 'S-2299') });
    return this;
  }
}

class AuditoriaBuilder {
  private readonly rubricas = new Map<string, Rubrica>();
  private readonly pessoas = new Map<string, Pessoa>();
  private readonly eventos: EventoFonte[] = [];
  private competencia = '2026-09';

  comRubrica(
    codigo: string,
    classe: keyof typeof TIPO,
    {
      tabela = '001',
      natureza = '1000',
      incidencias = { inss: '11', irrf: '11', fgts: '11' },
    }: { tabela?: string; natureza?: string; incidencias?: Rubrica['incidencias'] } = {},
  ): this {
    const origem = umaOrigem(`ID-S1010-${codigo}`, 'S-1010');
    this.eventos.push({ origem, retificacao: false, vigente: true });
    this.rubricas.set(chaveRubrica(codigo, tabela), {
      codigo,
      tabela,
      descricao: `Rubrica ${codigo}`,
      natureza,
      tipo: TIPO[classe],
      incidencias,
      validade: { inicio: '2026-01' },
      origem,
    });
    return this;
  }

  comPessoa(cpf: string, montar: (p: PessoaBuilder) => PessoaBuilder = (p) => p): this {
    this.pessoas.set(cpf, montar(new PessoaBuilder(cpf)).pessoa);
    return this;
  }

  naCompetencia(competencia: string): this {
    this.competencia = competencia;
    return this;
  }

  /** Congelado em profundidade: uma regra não consegue alterar o que a próxima lê. */
  construir(): Readonly<Auditoria> {
    return congelar({
      leiaute: 'S-1.3',
      pacoteXsd: '2026-07-01',
      empregador: { tipoInscricao: '1', raiz: '11222333' },
      competencia: this.competencia,
      apuracao: this.competencia.length === 4 ? 'anual' : 'mensal',
      eventos: this.eventos,
      rubricas: this.rubricas,
      pessoas: this.pessoas,
    });
  }
}

export const umaAuditoria = () => new AuditoriaBuilder();

/** Object.freeze recursivo; Maps viram somente leitura (set/delete/clear lançam). */
export function congelar<T>(valor: T): T {
  if (valor instanceof Map) {
    for (const v of valor.values()) congelar(v);
    const proibido = () => {
      throw new TypeError('Modelo congelado');
    };
    Object.assign(valor, { set: proibido, delete: proibido, clear: proibido });
    return Object.freeze(valor);
  }
  if (typeof valor === 'object' && valor !== null) {
    for (const v of Object.values(valor)) congelar(v);
    return Object.freeze(valor);
  }
  return valor;
}
