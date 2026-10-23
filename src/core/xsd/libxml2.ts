// Única porta para a libxml2-wasm: carrega o pacote da memória, valida e
// sempre libera (dispose) cada documento.
import {
  XmlBufferInputProvider,
  XmlDocument,
  XmlLibError,
  XmlParseError,
  XsdValidator,
  xmlRegisterInputProvider,
  type ErrorDetail,
} from 'libxml2-wasm';
import {
  MAX_ERROS_POR_EVENTO,
  type ErroXsd,
  type PacoteXsd,
  type ResultadoXsd,
  type Validador,
} from './tipos.ts';

const ESQUEMA_URL = 'pacote://';
const NS_ASSINATURA = 'http://www.w3.org/2000/09/xmldsig#';

// Um provedor só, registrado uma vez: cada pacote entra com o prefixo da sua data.
let provedor: XmlBufferInputProvider | undefined;
function provedorGlobal(): XmlBufferInputProvider {
  if (!provedor) {
    provedor = new XmlBufferInputProvider({});
    xmlRegisterInputProvider(provedor);
  }
  return provedor;
}

const decodificador = new TextDecoder('utf-8');

/** Arquivo raiz do evento: o .xsd cujo targetNamespace é o do evento e que declara `eSocial`. */
// CONFERIR NO LEIAUTE S-1.3: organização do pacote oficial (D-07) — um .xsd por evento com o
// targetNamespace do evento e o elemento raiz eSocial.
function acharRaiz(pacote: PacoteXsd, namespace: string): string | undefined {
  const candidatos: string[] = [];
  for (const [nome, bytes] of pacote.arquivos) {
    const texto = decodificador.decode(bytes);
    const ns = /\btargetNamespace\s*=\s*["']([^"']*)["']/.exec(texto)?.[1];
    if (ns === namespace && /<(?:\w+:)?element\s[^>]*\bname\s*=\s*["']eSocial["']/.test(texto)) {
      candidatos.push(nome);
    }
  }
  return candidatos.length === 1 ? candidatos[0] : undefined;
}

/** D-08: a falta de `Signature` não é erro quando o XML é o exportado antes de assinar. */
function ehFaltaDeAssinatura(detalhe: ErrorDetail): boolean {
  return (
    detalhe.message.includes('Missing child element') &&
    detalhe.message.includes(`{${NS_ASSINATURA}}Signature`)
  );
}

function paraErro(detalhe: ErrorDetail): ErroXsd {
  return {
    linha: detalhe.line,
    coluna: detalhe.col,
    mensagem: detalhe.message.trim(),
    ...(detalhe.xpath ? { caminho: detalhe.xpath } : {}),
  };
}

export interface OpcoesValidador {
  /** D-08: validar sem assinatura digital. Padrão: sim. */
  aceitarSemAssinatura?: boolean;
}

export function criarValidadorLibxml2(
  pacote: PacoteXsd,
  { aceitarSemAssinatura = true }: OpcoesValidador = {},
): Validador {
  const base = `${ESQUEMA_URL}${pacote.data}/`;
  const entrada = provedorGlobal();
  for (const [nome, bytes] of pacote.arquivos) entrada.addBuffer(base + nome, bytes);

  const validadores = new Map<string, XsdValidator | undefined>();
  let liberado = false;

  const validadorDe = (namespace: string): XsdValidator | undefined => {
    if (validadores.has(namespace)) return validadores.get(namespace);
    const raiz = acharRaiz(pacote, namespace);
    let validador: XsdValidator | undefined;
    if (raiz) {
      const bytes = pacote.arquivos.get(raiz);
      const doc = XmlDocument.fromBuffer(bytes ?? new Uint8Array(), { url: base + raiz });
      try {
        validador = XsdValidator.fromDoc(doc);
      } finally {
        doc.dispose();
      }
    }
    validadores.set(namespace, validador);
    return validador;
  };

  return {
    pacote: pacote.data,

    validar(xml, namespace): ResultadoXsd {
      if (liberado) throw new Error('Validador já liberado');
      const validador = validadorDe(namespace);
      if (!validador) return { status: 'sem-esquema' };

      // O texto já está decodificado: o encoding declarado no XML não vale mais.
      let doc: XmlDocument;
      try {
        doc = XmlDocument.fromString(xml, { encoding: 'utf-8' });
      } catch (erro) {
        if (!(erro instanceof XmlParseError)) throw erro;
        return {
          status: 'malformado',
          erros: erro.details.slice(0, MAX_ERROS_POR_EVENTO).map(paraErro),
        };
      }
      try {
        validador.validate(doc);
        return { status: 'valido', assinaturaAusente: false };
      } catch (erro) {
        if (!(erro instanceof XmlLibError)) throw erro;
        const semAssinatura = erro.details.filter(ehFaltaDeAssinatura);
        const restantes = aceitarSemAssinatura
          ? erro.details.filter((d) => !ehFaltaDeAssinatura(d))
          : erro.details;
        const assinaturaAusente = aceitarSemAssinatura && semAssinatura.length > 0;
        if (restantes.length === 0) return { status: 'valido', assinaturaAusente };
        return {
          status: 'invalido',
          assinaturaAusente,
          erros: restantes.slice(0, MAX_ERROS_POR_EVENTO).map(paraErro),
          total: restantes.length,
        };
      } finally {
        doc.dispose();
      }
    },

    dispose() {
      if (liberado) return;
      liberado = true;
      for (const validador of validadores.values()) validador?.dispose();
      validadores.clear();
      for (const nome of pacote.arquivos.keys()) entrada.removeBuffer(base + nome);
    },
  };
}
