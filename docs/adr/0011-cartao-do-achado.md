# ADR 0011 · Cartão do achado e "ver no XML" (HU-03)

- **Estado:** aceito
- **Data:** 24/10/2026
- **Etapa:** 3.3

## Decisões

1. **O cartão abre num `<dialog>` nativo** (`showModal`): foco preso no cartão, Esc fecha, o foco volta para a lista. Cada linha de achado virou `<button>` (teclado e leitor de tela).
2. **Conteúdo, na ordem da HU-03:** severidade + código e versão da regra; a frase com os valores em reais grifados (marca-texto, via `<mark>`, sem HTML vindo de dado); "O que vimos" (esperado × encontrado × diferença e os outros valores, com rótulos em português); "Mensagens do esquema" na R001; "Por que importa" e "Como corrigir" (textos da regra); "Onde está" (trabalhador mascarado + matrícula, arquivo, evento e posição, Id, campo); "Ver no XML"; anterior/próximo dentro dos achados visíveis com os filtros atuais.
3. **"Ver no XML" relê o arquivo local** (`verNoXml` no worker): a tela guarda só as referências `File`; o worker lê o arquivo de novo, separa o evento pela posição (o mesmo `lerLote` da auditoria) e devolve só o trecho em volta do campo. O texto bruto não fica em memória entre uma leitura e outra (RNF-05).
4. **Como acha a linha:** o XML é quebrado com uma tag por linha (os lotes reais vêm numa linha só) e recuado por nível, só para leitura. O campo é procurado a partir da ocorrência indicada no caminho (`ideBenef/infoPgto[2]` → o segundo `infoPgto`, depois o `vrLiq`); na R001, o campo vem da primeira mensagem do XSD (`Element '…cpfTrab'`). Sem localizar, mostra o começo do evento e diz isso.
5. **Mostrado como texto** (`<pre>` com uma `<div>` por linha), nunca `dangerouslySetInnerHTML` (seção 9 do doc); o teste de ponta a ponta confere que a tag do XML não vira elemento da página.
6. **"Foi útil?" e "Ignorar com motivo" ficam para o Marco 6**: os dois dependem de guardar no servidor (HU-05, `Feedback`).
