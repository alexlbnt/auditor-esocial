# ADR 0006 · Motor de regras, formato do achado e chave HMAC

- **Estado:** aceito
- **Data:** 23/10/2026
- **Etapa:** 1.4

## Decisões

1. **Motor** (`src/core/rules/engine.ts`): roda as regras em ordem de código; isola falhas (a regra que lança vira "não executada", registrando só o nome do erro, porque a mensagem pode conter dado do XML); ordena os achados por regra, CPF, arquivo, posição, caminho, campo e chave. Toda regra que não roda aparece em `naoExecutadas` com o motivo: `leiaute-nao-suportado` (fora da faixa de pacotes), `xsd-nao-executado` (precisa do XSD), `modelo-indisponivel` (lote sem modelo) ou `falhou`. O tempo vem de um relógio injetado: o core não lê o relógio.
2. **A regra só rebaixa a severidade.** Subir lança erro e a regra vira "não executada".
3. **A R001 é uma regra do catálogo** (textos, versão, ficha, fixtures) que relata os reprovados da etapa de XSD, recebidos em `ContextoRegra.xsd`. Com `independeDoModelo`, ela roda mesmo quando nenhum evento sobra para o modelo; as outras ficam como "modelo indisponível". Um achado por evento, não por arquivo (ficha atualizada).
4. **Chave do achado:** HMAC-SHA256(segredo, regra + CPF + campo + competência + `discriminador`). O `discriminador` (extensão ao doc) separa achados da mesma regra, CPF, campo e competência que não são o mesmo problema (ex.: dois demonstrativos); precisa ser estável entre auditorias (o `ideDmDev`, o `Id` do evento), nunca o nome do arquivo.
5. **SHA-256 e HMAC implementados no core**, síncronos e puros (o motor é síncrono; `crypto.subtle` é assíncrono e o core não usa `node:crypto`). Conferidos com os vetores do FIPS 180-4 e da RFC 4231 e contra o `node:crypto` em tamanhos de borda.
6. **A chave é codificada em base32 só com letras** (52 caracteres): em hexadecimal, cerca de 11% das chaves teriam 11 dígitos seguidos e o servidor as recusaria. Com letras, isso é impossível.
7. **O segredo vem de quem chama** (conta, sessão; o `audit-cli` sorteia um por execução). Sem segredo, as regras não rodam: um segredo fixo deixaria a chave reversível por força bruta.
8. **`paraEnvio()`** (`src/core/findings/envio.ts`) é a única forma de um achado sair do navegador: CPF mascarado, arquivo/Id/matrícula/causa/textos saneados, números com 11 dígitos ou mais viram texto saneado, e uma última trava recusa o achado se o JSON ainda tiver 11 dígitos seguidos. A mensagem da libxml2 (que cita valores) só sai assim.
