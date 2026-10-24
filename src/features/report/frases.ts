// A frase de cada achado, em linguagem de DP, montada na tela a partir dos valores
// (o achado não carrega texto, ADR 0006). Sem jargão de XML e sem culpar ninguém.
import type { Achado } from '@/core/findings/tipos';
import { formatarCompetencia, formatarReais } from '@/shared/formatacao';

/** `77|001` -> `rubrica 77 (tabela 001)` */
export function rotuloRubrica(chave: string): string {
  const [codigo, tabela] = chave.split('|');
  return tabela ? `rubrica ${codigo} (tabela ${tabela})` : `rubrica ${chave}`;
}
const listaDeRubricas = (v: unknown) => String(v).split(', ').map(rotuloRubrica).join(', ');

const dinheiro = (v: unknown) => (typeof v === 'number' ? formatarReais(v) : '?');
const data = (v: unknown) => {
  const [ano, mes, dia] = String(v).split('-');
  return dia ? `${dia}/${mes}/${ano}` : String(v);
};

/** Frase do achado. Regra sem frase própria cai no título da regra. */
export function fraseDoAchado(achado: Achado, titulo: string): string {
  const v = achado.valores ?? {};
  switch (achado.regra) {
    case 'R001':
      return `O XML não segue o esquema do eSocial: ${String(v.total ?? '?')} erro(s) de estrutura.`;
    case 'R002':
      if (v.motivo === 'sem-S-1210') {
        return `Nenhum S-1210 no lote: os líquidos de ${String(v.demonstrativos)} demonstrativo(s) não foram conferidos.`;
      }
      if (v.motivo === 'sem-S-1010') {
        return `Nenhum S-1010 no lote: sem a tabela de rubricas, os líquidos de ${String(v.demonstrativos)} demonstrativo(s) não foram conferidos.`;
      }
      if (v.rubricasSemCadastro) {
        return `O S-1210 pagou ${dinheiro(v.encontrado)}, mas não deu para conferir: ${listaDeRubricas(v.rubricasSemCadastro)} sem cadastro no S-1010.`;
      }
      return `O S-1210 pagou ${dinheiro(v.encontrado)}, mas o demonstrativo fecha em ${dinheiro(v.esperado)}. Diferença de ${dinheiro(v.diferenca)}.`;
    case 'R003':
      return `Desligado em ${data(v.dataDesligamento)}, mas tem folha de ${formatarCompetencia(String(v.competencia))}.`;
    case 'R009':
      return `A ${rotuloRubrica(String(v.rubrica))} está com ${achado.campo} ${String(v.encontrado)}; para a natureza ${String(v.natureza)} o esperado é ${String(v.esperado)}.`;
    default:
      return titulo;
  }
}
