# R001 · XML fora do esquema (Erro)

**Em linguagem de DP:** o arquivo não segue a estrutura oficial do eSocial. Ele seria rejeitado na transmissão. Por isso o evento fica fora do resto da auditoria, para não gerar achados em cascata.

**Quando aparece:** a validação contra o pacote XSD oficial (o mesmo que o eSocial usa) encontrou erro. Um achado por evento reprovado, com até 5 mensagens e a linha de cada uma.

**Quando não aparece:**

- Falta só a assinatura digital (D-08): o XML exportado antes de assinar é aceito, com um aviso único no cabeçalho.
- O XML nem é bem-formado: isso é problema de entrada e aparece em "fora da auditoria".
- O XSD não rodou (nenhum pacote disponível): a R001 aparece como "não executada".

**Exemplo:** `vrRubr` com vírgula decimal (`500,00`) ou CPF com 10 dígitos.

**Como corrigir:** corrigir o dado na folha e gerar o XML de novo; não editar o XML na mão.

**Fixtures:** `dispara.xml` é o S-1200 anonimizado com CPF de 10 dígitos e valor com vírgula; `limpo.xml` é o mesmo S-1200 sem os erros.

**Referência:** pacotes XSD S-1.3 em `schemas/xsd/S-1.3/`; ficha em `docs/arquitetura.md`, seção 11.
