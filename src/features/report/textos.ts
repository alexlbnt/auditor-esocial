// Textos do bloco "fora da auditoria", em linguagem de DP.
import type { MotivoFora } from '@/core/ingest/tipos';
import type { MotivoNaoExecutada } from '@/core/rules/tipos';

export const MOTIVO_FORA: Record<MotivoFora, string> = {
  'nao-xml': 'não é um arquivo XML',
  'xml-malformado': 'XML com estrutura quebrada (não dá para ler)',
  'encoding-nao-suportado': 'codificação de caracteres não reconhecida',
  'xml-nao-reconhecido': 'XML que não é evento do eSocial nem lote de envio',
  'evento-fora-do-mvp': 'evento que o Pente Fino ainda não audita',
  'leiaute-nao-suportado': 'versão de leiaute diferente da S-1.3',
  'exclusao-nao-considerada': 'exclusão (S-3000) não considerada',
  'zip-corrompido': 'zip que não abriu',
  'zip-aninhado': 'zip dentro de zip dentro de zip (só um nível é aberto)',
  'xsd-indisponivel': 'sem esquema no pacote XSD usado',
  'leitura-nao-implementada': 'evento que ainda não é lido nesta versão',
  'leitura-falhou': 'campo obrigatório ausente',
  'valor-invalido': 'valor em formato inválido',
  'outra-competencia': 'de outra competência',
};

export const MOTIVO_NAO_EXECUTADA: Record<MotivoNaoExecutada, string> = {
  'leiaute-nao-suportado': 'não vale para este pacote do leiaute',
  'xsd-nao-executado': 'precisa da validação de esquema, que não rodou',
  'modelo-indisponivel': 'nenhum evento sobrou para montar os trabalhadores',
  falhou: 'falhou durante a execução',
};
