# ADR 0003 · Validador XSD (R001) com libxml2-wasm

- **Estado:** aceito
- **Data:** 23/10/2026
- **Etapa:** 1.2

## Contexto

Os pacotes oficiais ainda não estão em `schemas/xsd/` (pendência 0.2 do Alex). A etapa foi feita com um pacote de brinquedo em `test/fixtures/xsd-brinquedo/`, que imita a forma esperada: um `.xsd` por evento, `tipos.xsd` incluído e `xmldsig-core-schema.xsd` importado.

## Decisões

1. **Interface `Validador` trocável** (`src/core/xsd/tipos.ts`), com `validar(xml, namespace)` e `dispose()`. Só `src/core/xsd/libxml2.ts` importa a `libxml2-wasm`; o plano B (API em C#) implementa a mesma interface.
2. **Pacote em memória:** um único `XmlBufferInputProvider` registrado uma vez; cada pacote entra com o prefixo `pacote://<data>/`, então dois pacotes convivem. A libxml2 pede os `import`/`include` já resolvidos para esse prefixo (conferido).
3. **Raiz do evento pelo `targetNamespace`**, não pelo nome do arquivo: o único `.xsd` do pacote com o namespace do evento e o elemento `eSocial`. Assim não é preciso adivinhar nomes de arquivo (D-07). O esquema compilado de cada evento é guardado e reaproveitado; o documento do XML de cada evento é liberado (`dispose`) logo depois da validação.
4. **D-08:** por padrão, a falta de `ds:Signature` não reprova. O validador reconhece a mensagem da libxml2 ("Missing child element ... `{http://www.w3.org/2000/09/xmldsig#}Signature`"), tira esse erro e conta o evento em `semAssinatura`, para um aviso único no cabeçalho. Dá para desligar (`aceitarSemAssinatura: false`).
5. **XML malformado no XSD vira erro de entrada** (`fora da auditoria`), nunca R001.
6. **Evento sem esquema no pacote vai para "fora da auditoria"** (`xsd-indisponivel`); nunca passa como aprovado.
7. **Sem pacote nenhum, a auditoria segue e registra `xsd: 'nao-executado'`.** O `audit-cli` diz isso em destaque. A tela (Marco 3) vai precisar mostrar o mesmo.
8. **As mensagens da libxml2 citam valores do XML, inclusive CPF** (conferido). Elas ficam só na memória; o `audit-cli` as imprime saneadas e a serialização dos achados (1.4) precisa sanear também.
9. **O texto vai para a libxml2 já decodificado**, com `encoding: 'utf-8'`, para o `encoding` da declaração XML não ser aplicado duas vezes.
10. **`core/audit.ts` nasce aqui** e orquestra ingest → XSD. O `audit-cli` passa a usá-lo.
