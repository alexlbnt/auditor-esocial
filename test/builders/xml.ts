// Gerador de XML fictício. Estrutura copiada de test/fixtures/s1200-lote-anonimizado.xml;
// o corpo dos eventos fica para o parse (etapa 1.3).
import { NS_LOTE_ENVIO } from '../../src/core/leiaute/eventos.ts';

const EMPREGADOR = '<ideEmpregador><tpInsc>1</tpInsc><nrInsc>11222333</nrInsc></ideEmpregador>';

/** Id no formato observado no S-1200 real: ID + tpInsc + inscrição + AAAAMMDDHHMMSS + sequencial. */
export function umId(sequencial = 1): string {
  return `ID11122233300000020261020143342${String(sequencial).padStart(5, '0')}`;
}

export interface OpcoesEvento {
  evento?: string;
  versao?: string;
  id?: string;
  corpo?: string;
}

export function umEvento({
  evento = 'evtRemun',
  versao = 'v_S_01_03_00',
  id = umId(),
  corpo = EMPREGADOR,
}: OpcoesEvento = {}): string {
  return (
    `<eSocial xmlns="http://www.esocial.gov.br/schema/evt/${evento}/${versao}">` +
    `<${evento} Id="${id}">${corpo}</${evento}></eSocial>`
  );
}

/** Envelope `envioLoteEventos` com os eventos dados, na ordem. */
export function umLote(eventos: readonly string[]): string {
  const blocos = eventos
    .map((xml) => `<evento Id="${/Id="([^"]*)"/.exec(xml)?.[1] ?? ''}">${xml}</evento>`)
    .join('');
  return (
    `<eSocial xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="${NS_LOTE_ENVIO}">` +
    `<envioLoteEventos grupo="3">${EMPREGADOR}` +
    '<ideTransmissor><tpInsc>1</tpInsc><nrInsc>11222333000181</nrInsc></ideTransmissor>' +
    `<eventos>${blocos}</eventos></envioLoteEventos></eSocial>`
  );
}

export function bytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}
