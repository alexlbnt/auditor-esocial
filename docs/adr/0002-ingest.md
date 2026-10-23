# ADR 0002 · Ingest: identificação do evento e limites de entrada

- **Estado:** aceito
- **Data:** 23/10/2026
- **Etapa:** 1.1

## Decisões

1. **O evento é identificado pelo namespace da raiz** (`.../schema/evt/<nome>/<versão>`). O `<nome>` define o tipo e a `<versão>` define o leiaute. Só `v_S_01_03_00` é suportado. Outra versão vira "leiaute não suportado", evento fora dos sete vira "evento fora do MVP" e S-3000 vira "exclusão não considerada".
2. **O envelope `envioLoteEventos` é aberto por uma leitura superficial de tags** (`src/core/ingest/tags.ts`), depois do `XMLValidator` do fast-xml-parser confirmar que o arquivo é bem-formado. O ingest não lê o conteúdo do evento; isso fica para o parse (1.3).
3. **Cada evento sai como texto próprio** (`EventoBruto.xml`), pronto para o XSD (R001) e o parse. O trecho herda os `xmlns:*` declarados no envelope (o lote real declara `xsi` e `xsd` lá), senão a libxml2 reprovaria um evento correto. Um trecho que não fica bem-formado sozinho vai para "fora da auditoria" como XML malformado.
4. **XML malformado é erro de entrada, não R001.** O detalhe guarda só o código e a linha/coluna, porque a mensagem da biblioteca pode citar conteúdo do XML.
5. **Encoding:** o texto é decodificado pelo `encoding` da declaração XML (UTF-8 se não houver), com `TextDecoder` em modo estrito. Encoding desconhecido ou bytes que não batem vão para "fora da auditoria" (`encoding-nao-suportado`). A seção 7.1 do doc pede R001 nesse caso; fica assim até existir R001 (1.2), quando decidimos se vira achado.
6. **RNF-06 recusa o lote inteiro** antes do processamento pesado. A taxa de compressão é conferida por arquivo, pelo tamanho declarado no diretório do zip, antes de descompactar. Quantidade e tamanho total contam os arquivos de dentro dos zips. Um nível de zip dentro de zip é aberto; mais fundo vai para "fora da auditoria".
7. **Ordem determinística:** as entradas e o conteúdo dos zips são ordenados por caminho (comparação por código de caractere, sem depender de locale).
8. **`TextDecoder` declarado à mão em `src/core/ambiente.d.ts`**, porque o `tsconfig` do core não tem DOM nem Node. É padrão WHATWG e existe no navegador, no worker e no Node.
9. **O `audit-cli` chama `lerLote` direto** nesta etapa. O `core/audit.ts`, que orquestra as etapas, nasce quando houver mais de uma (1.2).

## Medição

Lote sintético com 10.301 arquivos (5.000 S-1200 com 40 rubricas, 5.000 S-1210, 300 S-1010 e 1 arquivo que não é XML), zip de 4 MB: **2,3 s** no `audit-cli` (Node 24, notebook do Alex).
