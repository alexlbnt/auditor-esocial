# Auditor eSocial — Arquitetura e Produto

Oct 21, 2026 · @Alex

**Pronto para começar o desenvolvimento em 22/10/2026.** Este documento registra as decisões de estrutura, arquitetura, produto e processo do Auditor eSocial. O [documento de escopo](https://claude.ai/artifact/W64w4UkLCFy1AwWHxMpp5c) continua sendo a fonte oficial: nada aqui reabre o que já foi decidido lá. **Como ler:** para começar a codar, vá direto ao item 6 (plano, Marco 0) e ao item 10 (processo); ao implementar uma regra, a ficha dela no item 11 é o contrato; dúvidas de porquê ficam nos itens 1 a 5 e no Registro de decisões, no fim. O que ainda depende de você e não é código está em Pendências fora do código.

## 1. Estrutura do repositório

**Recomendação: um único app Next.js, com o núcleo de domínio isolado em `src/core`, sem monorepo por enquanto.** Um repositório, um deploy e um `package.json` cabem no seu tempo livre. O isolamento do núcleo permite extraí-lo para um pacote depois, sem reescrita.

### Opções consideradas

| Opção | A favor | Contra | Veredito |
| --- | --- | --- | --- |
| App único com `src/core` isolado | Um deploy, configuração mínima, mesmo padrão `features/` + `shared/` que você já usa no Sísifo | A fronteira depende de regra de lint, não do empacotador | Recomendada |
| Monorepo (`apps/web` + `packages/core`) | Fronteira física entre núcleo e app | Mais configuração (workspaces, build de pacote, diretório raiz na Vercel) sem ganho no MVP | Migrar só se surgir um segundo consumidor em TypeScript |
| Pastas por camada técnica (`components/`, `services/`, `utils/`) | Familiar | Regra, teste e XML de exemplo ficam espalhados | Descartada |

### Árvore proposta

```
auditor-esocial/
├─ src/
│  ├─ app/                      # rotas do Next.js (App Router)
│  │  ├─ (site)/                # página pública
│  │  ├─ (app)/auditorias/      # upload, relatório, histórico
│  │  └─ api/                   # route handlers: salvar achados, histórico
│  ├─ core/                     # domínio puro: sem React, Next, Prisma ou DOM
│  │  ├─ leiaute/               # versões suportadas e como identificar a versão de um XML
│  │  ├─ ingest/                # zip, leitura de arquivos, identificação do evento
│  │  ├─ xsd/                   # interface do validador + implementação (item 4)
│  │  ├─ parse/                 # XML -> dados por evento (um arquivo por evento)
│  │  ├─ model/                 # modelo canônico (item 2)
│  │  ├─ rules/                 # motor + catálogo (item 3)
│  │  │  ├─ engine.ts
│  │  │  ├─ registry.ts
│  │  │  └─ catalog/
│  │  │     └─ R002-liquido-pagamento/
│  │  │        ├─ rule.ts
│  │  │        ├─ rule.test.ts
│  │  │        ├─ README.md     # regra em linguagem de DP + referência no MOS
│  │  │        └─ fixtures/     # XMLs fictícios: caso que dispara e caso limpo
│  │  ├─ findings/              # tipo do achado, severidade, máscara de CPF
│  │  └─ audit.ts               # orquestra: ingest -> xsd -> parse -> model -> rules
│  ├─ workers/
│  │  └─ audit.worker.ts        # roda o core fora da thread da tela
│  ├─ features/                 # UI por funcionalidade
│  │  ├─ upload/
│  │  ├─ audit-run/             # progresso e comunicação com o worker
│  │  ├─ report/
│  │  ├─ export/                # PDF e Excel
│  │  └─ history/
│  ├─ server/                   # só servidor: Prisma, auth, repositórios
│  └─ shared/                   # componentes de UI, utilitários, formatação
├─ prisma/schema.prisma
├─ schemas/xsd/S-1.3/2026-07-01/ # XSDs oficiais, uma pasta por data do pacote
├─ test/
│  ├─ builders/                 # gerador de XML fictício por evento
│  └─ e2e/                      # auditoria completa de um lote fictício
├─ scripts/audit-cli.ts         # Fase 0: roda as regras no terminal
├─ local-data/                  # XMLs reais autorizados: no .gitignore, nunca commitados
└─ docs/
   ├─ adr/                      # uma decisão por arquivo
   └─ leiaute/                  # anotações sobre leiaute e Notas Técnicas
```

### Regras de dependência

- `core` não importa nada do resto do projeto nem de React, Next ou Prisma. Roda igual no navegador, no worker, no Vitest e no script de terminal.
- `features` e `workers` usam `core`. `server` usa só os tipos de `core` (achado, severidade), nunca o parser.
- `app` monta as páginas a partir de `features` e não tem regra de negócio.
- A fronteira é garantida por `no-restricted-imports` do ESLint no CI, não por disciplina.
- O XML nunca chega a `server`. Só a lista de achados, com CPF já mascarado, atravessa para a API.

### Uma pasta por regra

Código, teste, XML fictício e explicação para o DP ficam juntos. Criar a R015 vira copiar uma pasta. O código fixo no nome da pasta (R001 a R014) bate com o catálogo do escopo e com o que aparece no relatório.

### Script de terminal desde o primeiro dia

`scripts/audit-cli.ts` chama o mesmo `core/audit.ts` que o navegador. Ele atende o protótipo da Fase 0 (regras 2, 3 e 9) e permite rodar os XMLs reais localmente, sem tela e sem servidor.

### Plano B (API em C#)

Não entra na árvore agora. Se a validação XSD no navegador não for viável, a API entra em `services/xsd-api/` (ou num repositório próprio) e implementa a mesma interface de `core/xsd/`. O resto do `core` não muda.

### XMLs reais

O escopo ainda diz para nunca usar XMLs reais de clientes da Centi, mas você informou que agora tem autorização. Proposta: eles ficam só em `local-data/` (no `.gitignore`), o repositório é privado e uma checagem no CI falha se algum `.xml` fora de `fixtures/` for commitado. Vale atualizar essa linha no escopo para registrar a autorização.

### Fatos, hipóteses e o que verificar

**Fatos (do escopo):** stack Next.js, TypeScript, Tailwind, Prisma, Neon, Vercel e Vitest; processamento no navegador; sete eventos no MVP; 14 regras com código fixo; plano B em C#.

**Hipóteses (a validar no código):**

- Um Web Worker basta para lotes grandes sem travar a tela. Testar com o maior lote real disponível.
- Os XSDs oficiais podem ficar no repositório e ser servidos ao navegador. Depende da biblioteca de XSD escolhida no item 4.
- O mesmo `core` roda em Node (script e Vitest) e no navegador sem adaptação, desde que o parser escolhido funcione nos dois.

**Verificar na documentação oficial:**

- Como o pacote de XSDs da S-1.3 é organizado (arquivo por evento, arquivos de tipos compartilhados). Isso define o conteúdo de `schemas/xsd/`.
- Como o XML indica a versão do leiaute (pelo namespace do evento, a conferir no leiaute). Isso define `core/leiaute/`.
- Se a NT S-1.3 nº 07/2026 publica XSDs em mais de uma etapa até janeiro de 2027. Se sim, `schemas/xsd/` precisa de uma subpasta por pacote de XSD, não só "S-1.3".
- Se o XML de envio que o usuário tem é o evento solto ou vem dentro do lote de envio. O `ingest/` deve aceitar os dois até conferirmos com XMLs reais.

## 2. Modelo canônico

**Recomendação: duas camadas. O parser devolve os dados de cada evento quase como estão no XML, e um montador converte isso num modelo único, organizado por pessoa (CPF), que é a única coisa que as regras enxergam.** Quando uma Nota Técnica mudar um campo, muda o parser daquela versão e o montador; as regras continuam iguais.

```
XML -> parse/S-1.3/s1200.ts -> dados do evento (forma do leiaute)
                                      |
                               model/montar.ts
                                      v
                     Auditoria (modelo canônico) -> regras
```

### Como as peças se ligam

- **Auditoria** é a raiz: um empregador, uma competência, um tipo de apuração (mensal ou anual), a versão do leiaute e todos os eventos lidos.
- **Rubrica** vem do S-1010 e é indexada por código + tabela de rubricas.
- **Pessoa** é indexada por CPF e reúne trabalhador e beneficiário. Pendura nela os vínculos (matrículas), os demonstrativos, os pagamentos e os desligamentos.
- **Demonstrativo** é o centro: vem do S-1200, S-1202 ou S-1207, tem os itens de rubrica e é o que o pagamento do S-1210 referencia.
- **Origem** acompanha cada peça: arquivo, Id do evento e caminho do campo. É o que permite ao achado dizer de onde veio.

Exemplo: um S-1200 de um trabalhador gera um Demonstrativo com seus itens. O S-1210 do mesmo CPF gera um Pagamento que aponta para esse Demonstrativo. A R002 calcula o líquido do Demonstrativo e compara com o líquido do Pagamento.

### Tipos em TypeScript (esboço)

```ts
// Dinheiro em centavos inteiros; datas e competências como texto.
type Centavos = number;        // "1234.56" no XML -> 123456
type Competencia = string;     // "2026-09" (mensal) ou "2026" (anual), formato a conferir
type DataISO = string;         // "2026-09-30"
type Cpf = string;             // 11 dígitos, sem máscara (só em memória)
type ChaveRubrica = string;    // `${codigo}|${tabela}`

interface Origem {
  arquivo: string;
  eventoId: string;            // atributo Id do evento
  tipo: 'S-1010' | 'S-1200' | 'S-1202' | 'S-1207' | 'S-1210' | 'S-1299' | 'S-2299';
  caminho?: string;            // ex.: "dmDev[1]/itens[3]"
}

interface Auditoria {
  leiaute: string;             // ex.: "S-1.3" (namespace do evento)
  pacoteXsd: string;           // data do pacote usado, ex.: "2026-07-01"
  empregador: { tipoInscricao: string; raiz: string }; // texto: CNPJ pode ser alfanumérico
  competencia: Competencia;
  apuracao: 'mensal' | 'anual';
  eventos: EventoFonte[];      // todos, inclusive retificações e duplicados
  rubricas: ReadonlyMap<ChaveRubrica, Rubrica>;
  pessoas: ReadonlyMap<Cpf, Pessoa>;
  fechamento?: { origem: Origem };
}

interface EventoFonte {
  origem: Origem;
  retificacao: boolean;
  reciboOriginal?: string;
  cpf?: Cpf;
}

interface Rubrica {
  codigo: string;
  tabela: string;
  descricao: string;
  natureza: string;            // código cru da tabela de naturezas
  tipo: 'provento' | 'desconto' | 'informativa' | 'informativaDedutora';
  incidencias: { inss?: string; irrf?: string; fgts?: string; rpps?: string }; // códigos crus
  validade: { inicio: Competencia; fim?: Competencia };
  origem: Origem;
}

interface Pessoa {
  cpf: Cpf;
  vinculos: Vinculo[];
  demonstrativos: Demonstrativo[];
  pagamentos: Pagamento[];
  desligamentos: Desligamento[];
}

interface Vinculo {
  matricula?: string;
  categoria?: string;
  regime: 'RGPS' | 'RPPS';     // deduzido do evento (S-1200 ou S-1202)
  origem: Origem;
}

interface Demonstrativo {
  id: string;                  // identificador do demonstrativo
  fonte: 'RGPS' | 'RPPS' | 'beneficio'; // S-1200, S-1202 ou S-1207
  grupos: GrupoRemuneracao[];  // um por estabelecimento/lotação/matrícula
  beneficio?: string;          // só no S-1207
  periodoReferencia: Competencia;
  origem: Origem;
}

interface GrupoRemuneracao {
  estabelecimento: string;     // inscrição do estabelecimento (texto)
  lotacao: string;
  matricula?: string;
  itens: ItemRubrica[];
}

interface ItemRubrica {
  rubrica: ChaveRubrica;
  valor: Centavos;
  quantidade?: number;
  fator?: number;
  indApurIR?: string;          // código cru
  origem: Origem;
}

interface Pagamento {
  data: DataISO;
  periodoReferencia: Competencia;
  demonstrativoId: string;     // liga ao Demonstrativo
  liquido: Centavos;
  origem: Origem;
}

interface Desligamento {
  matricula?: string;
  data: DataISO;
  origem: Origem;
}
```

*Atualizado em 22/10/2026 com o S-1200 real: a matrícula fica por estabelecimento e lotação (`GrupoRemuneracao`), o item traz fator e `indApurIR`, o empregador é identificado pela raiz e o pacote de XSD fica registrado na auditoria.*

Totais não ficam guardados no modelo. Uma função `totais(demonstrativo, rubricas)` devolve proventos, descontos, líquido e a lista de rubricas sem cadastro. As regras 2, 13 e 14 usam a mesma função, então o cálculo do líquido existe num lugar só.

### Decisões e o porquê

1. **Pessoa por CPF, não por matrícula.** O pagamento é por pessoa e as regras 7 e 11 cruzam eventos pelo CPF. A matrícula fica no vínculo e no demonstrativo.
2. **Centavos inteiros, convertidos direto do texto do XML.** Nunca passar por `parseFloat`: 0,1 + 0,2 em ponto flutuante já gera diferença de centavo e falso positivo na R002.
3. **Códigos crus de incidência e natureza.** Não viram `true/false`, porque cada código tem significado próprio. A interpretação fica numa tabela versionada em `core/leiaute/S-1.3/`, usada pelas regras 9 e 10.
4. **Nada é resolvido em silêncio.** Duplicados e retificações ficam todos em `eventos`. O modelo não escolhe o "vencedor"; as regras 5 e 6 precisam ver tudo.
5. **Dado ausente é explícito.** Se a rubrica não está no S-1010 do lote, `totais` a devolve como sem cadastro. A R002 então rebaixa o achado ou explica que não conseguiu calcular, em vez de acusar diferença falsa.
6. **Somente leitura.** As regras recebem tipos `Readonly` e, nos testes, o modelo é congelado com `Object.freeze`. Uma regra não pode alterar o que a próxima vai ler.
7. **CPF completo só na memória do navegador.** A máscara é aplicada ao serializar o achado para o servidor, em `core/findings/`.
8. **Nomes do domínio em português** (Rubrica, Demonstrativo, Pagamento), na linguagem do DP. Nomes técnicos (engine, registry) ficam em inglês.

### Campos do leiaute a conferir

Os nomes da segunda coluna são os que eu espero encontrar, de memória. Nenhum deve ser codificado antes de conferido no leiaute S-1.3 vigente e na NT 07/2026.

| No modelo | Campo provável (conferir) | Eventos |
| --- | --- | --- |
| Competência | `perApur` | periódicos |
| Mensal ou anual | `indApuracao` | conferir em quais periódicos ainda existe |
| Retificação e recibo | `indRetif`, `nrRecibo` | todos |
| CPF | `cpfTrab`, `cpfBenef` | remuneração, pagamento, desligamento |
| Id do demonstrativo | `ideDmDev` | S-1200, S-1202, S-1207, S-1210 |
| Chave da rubrica | `codRubr`, `ideTabRubr` | S-1010 e remuneração |
| Tipo e natureza | `tpRubr`, `natRubr` | S-1010 |
| Incidências | `codIncCP`, `codIncIRRF`, `codIncFGTS`, `codIncCPRP` | S-1010 |
| Valor do item | `vrRubr` | remuneração |
| Matrícula e categoria | `matricula`, `codCateg` | S-1200, S-1202, S-2299 |
| Benefício | `nrBeneficio` | S-1207 |
| Pagamento | `dtPgto`, `perRef`, `vrLiq` | S-1210 |
| Desligamento | `dtDeslig` | S-2299 |

### Fatos, hipóteses e o que verificar

**Fatos (do escopo):** sete eventos no MVP; uma competência de uma empresa por vez; RPPS desde o MVP; CPF mascarado no servidor.

**Hipóteses (minhas):**

- O S-1210 aponta o demonstrativo pelo período de referência + identificador do demonstrativo. Se o vínculo for outro, só `Pagamento` e o montador mudam.
- Uma auditoria cobre um par competência + apuração. A folha mensal e o 13º seriam auditorias separadas.
- Remuneração de períodos anteriores entra no MVP só como achado Info ("há valores de períodos anteriores, não auditados"), sem regra própria.
- O `tipo` da rubrica tem os quatro valores do esboço. Conferir a lista no S-1010.

**Verificar antes do item 3:**

- **Regra 12 (evento depois do fechamento):** o XML de envio provavelmente não traz a data de transmissão. Se for isso, a regra depende do recibo ou do retorno, que está fora do MVP. Pode ser preciso reescrever ou adiar a regra.
- Como o S-1202 e o S-1207 identificam a pessoa e o benefício, para confirmar que "Pessoa por CPF" atende o RPPS.
- Onde ficam os valores de períodos anteriores nos eventos de remuneração, para o parser ao menos detectá-los.

## 3. Motor de regras

**Recomendação: cada regra é um objeto com metadados (código, versão, leiautes em que vale) e uma função pura e síncrona que recebe o modelo canônico e devolve achados.** O motor escolhe as regras válidas para o leiaute do lote, roda uma por uma no worker e isola falhas: se uma regra quebrar, as outras continuam e o relatório avisa qual não rodou.

### Interface da regra

```ts
type Severidade = 'erro' | 'alerta' | 'info';

interface Regra {
  codigo: string;              // "R002", fixo para sempre
  versao: number;              // sobe quando a lógica da regra muda
  titulo: string;              // em linguagem de DP
  severidade: Severidade;      // padrão; a regra pode rebaixar caso a caso
  eventos: TipoEvento[];       // eventos que ela lê
  leiautes: { de: string; ate?: string }; // faixa de versões em que vale
  explicacao: string;          // por que é risco (texto fixo)
  sugestao: string;            // o que fazer (texto fixo)
  executar(ctx: ContextoRegra): AchadoBruto[];
}

interface ContextoRegra {
  auditoria: Readonly<Auditoria>;  // modelo canônico (item 2)
  tabelas: TabelasLeiaute;         // interpretação dos códigos da versão do lote
}
```

A regra não importa tabela de leiaute nenhuma: recebe `tabelas` já da versão certa. Assim, a mesma regra roda em duas versões diferentes sem `if` de versão dentro dela.

### Exemplo: R002

```ts
export const R002: Regra = {
  codigo: 'R002',
  versao: 1,
  titulo: 'Líquido pago diferente do demonstrativo',
  severidade: 'erro',
  eventos: ['S-1200', 'S-1202', 'S-1207', 'S-1210'],
  leiautes: { de: 'S-1.3' },
  explicacao: 'O valor pago ao trabalhador não bate com proventos menos descontos...',
  sugestao: 'Confira se houve pagamento parcial ou rubrica fora do demonstrativo...',
  executar({ auditoria, tabelas }) {
    const achados: AchadoBruto[] = [];
    for (const pessoa of auditoria.pessoas.values()) {
      for (const dm of pessoa.demonstrativos) {
        const pagos = pessoa.pagamentos.filter(p => p.demonstrativoId === dm.id);
        if (pagos.length === 0) continue;           // a R011 cuida disso
        const t = totais(dm, auditoria.rubricas, tabelas);
        if (t.rubricasSemCadastro.length > 0) {     // não dá para afirmar: rebaixa
          achados.push({ severidade: 'alerta', pessoa, origem: dm.origem,
            valores: { semCadastro: t.rubricasSemCadastro.join(', ') } });
          continue;
        }
        const pago = pagos.reduce((s, p) => s + p.liquido, 0);
        if (pago !== t.liquido) {
          achados.push({ pessoa, origem: pagos[0].origem, campo: 'vrLiq',
            valores: { esperado: t.liquido, encontrado: pago } });
        }
      }
    }
    return achados;
  },
};
```

### O motor

```ts
function executarRegras(auditoria, registro, tabelas): ResultadoMotor {
  // 1. registro.aplicaveis(auditoria.leiaute) -> regras cuja faixa inclui a versão
  // 2. para cada regra, em ordem de código: try { executar } catch { falhas.push }
  // 3. completa cada AchadoBruto (código, versão, textos, chave) e ordena
  // 4. devolve { achados, regrasExecutadas: [{codigo, versao}], falhas, duracaoMs }
}
```

- **Ordem determinística.** Mesma entrada, mesma saída, na mesma ordem. Isso permite testar com arquivos de resultado esperado.
- **A R001 (XSD) é uma etapa anterior.** Ela roda sobre o XML cru, antes do parse, e gera achados no mesmo formato. Um evento que falha no XSD não entra no modelo, para não gerar achados em cascata; o cabeçalho do relatório diz quantos eventos ficaram de fora.
- **Leiaute não suportado nunca é silêncio.** Se nenhuma versão de uma regra vale para o lote, o motor registra "R0xx não executada: leiaute X não suportado".

### Versionamento por leiaute

Há dois tipos de mudança, tratados de forma diferente:

| O que mudou | Onde muda | A regra muda? |
| --- | --- | --- |
| Uma tabela ou código (ex.: novo código de incidência) | Nova pasta `core/leiaute/<versão>/` com as tabelas | Não |
| Um campo mudou de lugar ou de nome | Parser e montador da nova versão (item 2) | Não |
| A lógica de negócio da regra | Novo arquivo `R009/v2.ts`, com a faixa de leiaute nova; a v1 fecha a faixa com `ate` | Sim, mesmo código, versão 2 |

Cada achado e cada auditoria guardam `{codigo, versao}` das regras que rodaram. Um relatório antigo continua explicável depois que a regra mudar.

*Atualizado em 22/10/2026:* como vários pacotes de XSD têm o mesmo nome de versão (item 4), a faixa da regra passa a ser `leiautes: { versao: 'S-1.3', pacoteDe: '2026-07-01', pacoteAte?: string }`. O motor escolhe o pacote pela competência do lote (decisão D-09).

### Formato do achado

```ts
interface Achado {
  regra: string;               // "R002"
  regraVersao: number;
  severidade: Severidade;
  cpf?: Cpf;                   // completo no navegador; mascarado ao sair
  matricula?: string;
  evento: TipoEvento;
  eventoId: string;
  arquivo: string;
  campo?: string;              // nome do campo no leiaute, para o usuário achar
  valores?: Record<string, string | number>; // esperado x encontrado etc.
  chave: string;               // identifica o mesmo achado entre execuções
}
```

- **Os textos não vão no achado.** Título, explicação e sugestão vêm da regra (código + versão), e a mensagem é montada na tela com `valores`. O banco guarda menos dados, e corrigir um texto não exige migrar achados.
- **A `chave` sustenta o "ignorar"** previsto nos riscos do escopo. É um hash de regra + CPF + campo + competência, com um segredo por conta (HMAC). Hash simples de CPF é reversível por força bruta, porque CPF só tem 11 dígitos.
- **Valores em centavos** no achado; a formatação em R$ acontece só na tela e nas exportações.

### Como testar cada regra

1. **Teste de unidade sobre o modelo.** Um construtor monta a auditoria sem XML (`umaAuditoria().comPessoa(cpf).comDemonstrativo(...)`). Cobre o caso que dispara, o caso limpo e as bordas (rubrica sem cadastro, dois pagamentos, valor zero). Rápido e sem depender do parser.
2. **Teste com XML fictício.** Cada pasta tem `fixtures/dispara.xml` e `fixtures/limpo.xml`, que passam pelo caminho inteiro (parse, modelo, regra). Garante que o parser entrega o que a regra espera.
3. **Teste de contrato do catálogo,** um só para todas as regras: código único, README e os dois XMLs presentes, faixa de leiaute válida, não lança erro com auditoria vazia e devolve o mesmo resultado se rodar duas vezes no modelo congelado.
4. **Resultado esperado do lote completo.** Um lote fictício com um erro plantado por regra gera um JSON de achados versionado. Qualquer mudança aparece como diferença no PR.
5. **Regressão com XMLs reais, só local.** O script de terminal roda sobre `local-data/` e compara com uma linha de base salva também localmente. Nunca entra no CI.

### Fatos, hipóteses e o que verificar

**Fatos (do escopo):** 14 regras com código fixo e severidade definida; cada regra com descrição, evento e campo de origem, explicação e sugestão; regras versionadas por leiaute; função pura por regra com testes no Vitest.

**Hipóteses (minhas):**

- Regras síncronas e lineares no número de pessoas são rápidas o bastante no worker. Medir com o maior lote real.
- Um demonstrativo pode ter mais de um pagamento no S-1210, por isso a R002 soma os pagamentos.
- A versão lida do XML é fina o bastante para separar as etapas da NT 07/2026.

**Verificar na documentação oficial:**

- **Regras 4 e 6 podem duplicar validações do próprio eSocial.** Se o XSD ou as regras de validação já rejeitam CPF inválido ou retificação sem recibo, o escopo pede para não duplicar. Ainda pode valer manter como pré-checagem antes de transmitir; decidimos isso depois de conferir.
- Se o S-1210 admite mais de um pagamento para o mesmo demonstrativo e como isso aparece no XML.
- Como as etapas da NT 07/2026 aparecem na versão do XML (namespace), para definir o formato de `leiautes.de/ate`.

## 4. Bibliotecas

**Recomendação: libxml2-wasm para o XSD, fast-xml-parser para a leitura, fflate para o zip, @react-pdf/renderer para o PDF e write-excel-file para o Excel.** Rodei uma prova de conceito do XSD em WebAssembly e ela funcionou, então o plano B em C# continua guardado, não ativado. Versões conferidas no npm em 21/10/2026.

### Escolhas

| Função | Escolha | Versão e licença | Por quê | Descartada |
| --- | --- | --- | --- | --- |
| Validação XSD | [libxml2-wasm](https://www.npmjs.com/package/libxml2-wasm) | 0.7.2 (07/09/2026), MIT | libxml2 de verdade em WebAssembly, no mesmo processo. Carrega o XSD uma vez e reaproveita. Resolve import/include a partir da memória. O wasm vem embutido no JS (cerca de 960 KB) | [xmllint-wasm](https://www.npmjs.com/package/xmllint-wasm) 5.3.0: cria um worker por chamada, e o próprio README diz que o Firefox só funciona com bundler |
| Leitura do XML | [fast-xml-parser](https://www.npmjs.com/package/fast-xml-parser) | 5.11.2 (29/09/2026), MIT | Converte o XML num objeto fácil de mapear para o modelo. Roda em Node e no navegador | Ler tudo com libxml2-wasm: XPath campo a campo e `dispose()` manual, verboso e fácil de vazar memória |
| Zip | [fflate](https://www.npmjs.com/package/fflate) | 0.8.3 (16/05/2026), MIT, sem dependências | Pequeno, rápido, descompacta dentro do worker | [jszip](https://www.npmjs.com/package/jszip) 3.10.2: licença dupla MIT/GPL e 4 dependências |
| PDF | [@react-pdf/renderer](https://www.npmjs.com/package/@react-pdf/renderer) | 4.9.0 (27/08/2026), MIT, aceita React 19 | Layout com componentes React, o mesmo jeito de pensar da tela. Carregado só quando o usuário exporta | [jsPDF](https://www.npmjs.com/package/jspdf) 4.2.1 + jspdf-autotable 5.0.9: mais rápido em relatórios enormes, mas layout imperativo. Fica como plano B |
| Excel | [write-excel-file](https://www.npmjs.com/package/write-excel-file) | 4.1.1 (08/06/2026), MIT, 1 dependência | Só escreve (é o que precisamos), com várias abas, linha congelada e cores. Tem versão própria para navegador | [exceljs](https://www.npmjs.com/package/exceljs) 4.4.0: sem versão nova desde 10/2023. [xlsx](https://www.npmjs.com/package/xlsx) (SheetJS): no npm parado em 0.18.5, de 2022 |
| Comunicação com o worker | [comlink](https://www.npmjs.com/package/comlink) | 4.4.2 (11/2024), Apache-2.0 | Chama funções do worker como `async`, sem protocolo de mensagens feito à mão | `postMessage` puro |
| Validação na API | [zod](https://www.npmjs.com/package/zod) | 4.6.7 (12/10/2026), MIT | Valida a lista de achados que chega ao servidor | — |

Configuração importante do fast-xml-parser: `parseTagValue: false`, para CPF com zero à esquerda e valores decimais chegarem como texto (a conversão para centavos é nossa); `ignoreAttributes: false`, para ler o `Id` do evento; e `isArray` para os elementos que repetem, lista a tirar do XSD de cada evento.

### Prova de conceito do XSD

Rodei a libxml2-wasm 0.7.2 em Node 22 com um esquema que importa outro esquema, entregue da memória pelo `xmlRegisterInputProvider`:

- O XML válido passou.
- O XML inválido devolveu dois erros com linha e mensagem legível (CPF fora do padrão de 11 dígitos e valor não decimal).
- 5.000 validações de um documento pequeno levaram 136 ms.

Limites: foi em Node, não no navegador; o esquema era de brinquedo, não o oficial; e a API do provedor de arquivos está marcada como alfa pelo autor. Cada documento precisa de `dispose()`, então o validador fica embrulhado em `core/xsd/` e nada fora dele toca na biblioteca.

### Achado nos pacotes de XSD oficiais

A [página de documentação técnica do eSocial](https://www.gov.br/esocial/pt-br/documentacao-tecnica) lista oito pacotes de XSD da S-1.3, todos com o mesmo nome de versão (`esquemas_xsd_v_s_01_03_00`). Eles mudam só pela data de produção: 01/07/2026 (CNPJ alfanumérico), e 26/10/2026, 23/11/2026, 14/12/2026 e 18/01/2027 (etapas da NT 07/2026).

Isso muda dois pontos anteriores:

- **Item 1:** `schemas/xsd/` passa a ser organizado por data do pacote, por exemplo `schemas/xsd/S-1.3/2026-07-01/`.
- **Item 3:** a versão do leiaute provavelmente não pode ser lida só do XML, porque o nome da versão não muda entre etapas. A faixa de uma regra passa a ser "S-1.3, pacote a partir de tal data", e o motor escolhe o pacote pela data. Falta definir qual data: competência ou data de envio.

Não consegui baixar os pacotes daqui porque a rede deste ambiente bloqueia o download do gov.br. Então a estrutura interna (arquivos, imports e namespaces) ainda não foi conferida.

### Versões da stack já decidida

| Pacote | Versão atual | Atenção |
| --- | --- | --- |
| Next.js | 16.4.2 (15/10/2026) | Exige Node 20.9 ou mais |
| React | 19.3.1 (14/10/2026) | — |
| Vitest | 5.0.5 (15/10/2026) | Exige Node 22.12+ ou 24+ |
| Prisma | 7.10.1 (estável) | A tag `latest` do npm aponta para 8.0.0-rc.24, um *release candidate*. Fixe a 7.10.1 |

Use Node 22 LTS ou 24 no projeto e na Vercel, por causa do Vitest.

### Fatos, hipóteses e o que verificar

**Fatos (conferidos hoje):** versões e licenças da tabela; a prova de conceito acima; a lista de pacotes de XSD na página do gov.br.

**Hipóteses:**

- A libxml2-wasm funciona dentro de um Web Worker no Next.js 16 com Turbopack. O módulo detecta ambiente de worker, mas eu não testei no navegador.
- @react-pdf/renderer aguenta o maior relatório real. Se ficar lento, troca para jsPDF + autotable só dentro de `features/export/`.
- Os XSDs oficiais podem ficar no repositório, por serem documentação pública.

**Verificar (sua primeira noite de código):**

- Abrir os pacotes de 01/07/2026 e 26/10/2026 e comparar namespaces e arquivos. Isso confirma ou derruba o achado acima.
- Ver se o XSD do evento exige a assinatura digital (`Signature`). Se exigir e os XMLs que o usuário tem forem gerados antes de assinar, a R001 vai acusar erro em tudo. Conferir com os XMLs reais.
- Rodar a mesma prova de conceito no navegador, num worker, com o XSD real do S-1200 e o maior lote real que você tiver.

Fontes: páginas do npm de cada pacote (links na tabela, consultadas em 21/10/2026), [documentação técnica do eSocial](https://www.gov.br/esocial/pt-br/documentacao-tecnica) e [README do xmllint-wasm](https://www.npmjs.com/package/xmllint-wasm).

## 5. Parte criativa

**Recomendação: chamar o produto de Pente Fino, com identidade sóbria e precisa, e um relatório que agrupa achados pela causa e mostra o que mudou desde a última auditoria.** O nome explica o produto sozinho para qualquer pessoa de DP, e as duas ideias do relatório atacam o maior risco do escopo: falso positivo demais.

### Nome

| Nome | O que evoca | A favor | Contra |
| --- | --- | --- | --- |
| **Pente Fino** (recomendado) | "Passar o pente-fino": revisão minuciosa | Todo mundo no Brasil entende na hora. Diz o que o produto faz | Expressão comum; o registro de marca tende a sair como marca mista (nome + logo) |
| Bateu | "A folha bateu?", pergunta diária do DP | Simpático, vocabulário do público | Ambíguo fora de contexto e difícil de achar em busca |
| Esquadro | Instrumento que confere se o ângulo está certo | Distinto e sóbrio | Não diz o que faz; exige explicação |
| Argos | Gigante de cem olhos da mitologia grega | Curto, forte, conversa com Sísifo e Aurora | Nome muito usado por empresas (hipótese) e não diz o que faz |
| Contraprova | Termo de auditoria | Técnico e preciso | Longo e frio |

**Frase:** "Passe o pente-fino no eSocial antes que o fiscal passe."

**Evite "eSocial" no nome da marca.** É nome de sistema do governo e pode sugerir vínculo oficial. Use como descrição: "Pente Fino · auditoria de XML do eSocial".

**Checagem feita:** uma busca rápida na web não achou software de folha ou eSocial chamado Pente Fino, Bateu ou Esquadro. Isso não substitui a busca de marca. **Falta verificar:** busca no INPI (classes 9 e 42), domínios `.com.br` e `.app.br` e perfis em redes sociais. Não consegui consultar o registro.br daqui, porque a rede deste ambiente bloqueia.

### Identidade visual

- **Tom:** calmo e preciso, nunca alarmista. O usuário já está sob pressão de prazo; o produto mostra o problema e o caminho, sem sirene.
- **Cor principal:** azul-petróleo escuro (por volta de `#0F4C5C`). Passa confiança e foge do azul genérico de SaaS.
- **Severidade nunca só por cor:** Erro em vermelho com círculo, Alerta em âmbar com triângulo, Info em azul-acinzentado com quadrado. Funciona para daltônicos e no PDF impresso em preto e branco. Conferir contraste AA de cada cor sobre branco.
- **Tipografia:** IBM Plex Sans na interface e IBM Plex Mono para códigos (R002, rubrica, CPF mascarado). As duas são gratuitas e têm algarismos tabulares; com `font-variant-numeric: tabular-nums`, os valores alinham em coluna.
- **Logo:** um pente cujos dentes lembram linhas de um arquivo, com um dente destacado na cor de Erro: o achado no meio do lote.
- **Voz:** linguagem de DP, com valores, sem jargão de XML e sem culpar ninguém. Exemplo: "O S-1210 pagou R$ 3.210,00, mas o demonstrativo fecha em R$ 3.150,00. Diferença de R$ 60,00."

*Atualizado em 22/10/2026:* o Alex escolheu a **direção B (marca-texto)** (D-13). A tipografia e as cores acima valem para a direção A e ficam como registro. Na B: Manrope na interface, JetBrains Mono para códigos, fundo papel #FAF8F2, tinta #1E1D1A, grifo amarelo #FFE45C nos valores-chave, erro #B3261E, alerta #A87A00 (texto #7A5A00), informativo #4A5560, menu no topo. A estrutura das telas não muda. Protótipo clicável: [Pente Fino — telas](https://claude.ai/artifact/VsJAMDDHCvpY6YUDKGcth5), quadro "B · Protótipo clicável".

### Experiência do relatório

1. **Upload com a promessa visível.** "Seus XMLs não saem deste computador", com um selo que mostra o processamento acontecendo localmente.
2. **Progresso por etapa:** lendo, validando, montando, auditando, cada uma com contagem. Mostra trabalho e passa velocidade.
3. **Resumo no topo:** competência, empresa, número de trabalhadores e eventos, os três totais por severidade e quantos trabalhadores ficaram sem nenhum achado. Logo abaixo, um bloco honesto: "o que não foi auditado" (eventos fora do XSD, regras que não rodaram).
4. **Duas visões, por trabalhador ou por regra.** Por trabalhador é o padrão do escopo. Por regra serve para correção em massa.
5. **Agrupamento por causa.** Se a mesma rubrica mal cadastrada gera 340 achados, o relatório mostra um cartão "corrija a rubrica 1050 no S-1010 e resolva 340 achados", e não 340 linhas.
6. **Cartão do achado** com quatro partes: o que vimos (esperado x encontrado), por que importa, como corrigir e onde está (arquivo, evento, campo). Ações: ignorar com motivo e "este achado foi útil?".
7. **Ver no XML.** Ao clicar em "onde está", abre o trecho do XML com o campo destacado. Continua local, porque o XML está na memória do navegador.
8. **Duas exportações para dois públicos.** O PDF é para o cliente do escritório, com resumo, linguagem simples e CPF mascarado. O Excel é para a equipe, com uma linha por achado e filtros.

### Ideias que diferenciam

O próprio eSocial lançou em junho de 2025 um [módulo de relatórios](https://sitecontabil.com.br/noticias_empresariais/ler/esocial-lanca-modulo-de-relatorios-gerenciais-que-facilita-conferencia), mas ele lista vínculos e não cruza remuneração com pagamento. O espaço do produto continua aberto.

| Ideia | Impacto | Esforço | Quando |
| --- | --- | --- | --- |
| Agrupamento por causa | Alto: corta o ruído e o falso positivo percebido | Baixo nas regras de rubrica | MVP |
| "Este achado foi útil?" em cada cartão | Alto: mede falso positivo por regra | Baixo | MVP |
| Prova de privacidade: auditoria funciona com a internet desligada depois que a página carrega | Alto em venda e LGPD | Baixo (é consequência da arquitetura) | MVP |
| Modo RPPS: vocabulário de órgão público (servidor, órgão, beneficiário) | Médio, alto para a Centi | Baixo (textos alternativos por regra) | MVP |
| Reauditoria com diferença: resolvidos, novos e persistentes desde a última vez | Alto: vira rotina mensal | Médio (usa a `chave` do item 3) | Fase 2 |
| Página pública por regra ("R002: líquido diferente") explicando o erro | Médio: conteúdo educativo e porta de entrada via busca | Baixo (sai do README da regra) | Fase 2 |
| Resumo com IA para o cliente final, sem CPF | Médio | Médio | Fase 3 |
| Painel do escritório com semáforo por empresa | Alto para escritório grande | Alto | Fase 3 |

### Fatos, hipóteses e o que verificar

**Fatos:** a busca na web não achou conflito óbvio de nome no nicho; o módulo de relatórios do eSocial (06/2025) lista vínculos, sem cruzar remuneração e pagamento.

**Hipóteses:** agrupamento por causa e reauditoria são o que faz o contador voltar todo mês; a prova de privacidade pesa na decisão de compra. As duas valem como perguntas nas entrevistas da Fase 0.

**Verificar:** INPI, domínios e redes sociais para o nome escolhido; contraste das cores de severidade; se o termo "pente-fino" já é usado por algum concorrente em marketing.

## 6. Plano de execução

**O plano tem 7 marcos e cerca de 40 sessões de 1h30 a 2h. Com 3 sessões por semana, dá uns 3 meses até o MVP com pilotos.** O núcleo roda primeiro no terminal, porque esse é o protótipo da Fase 0 do escopo e serve para validar com contadores antes de investir na tela. Cada etapa termina num estado estável, com teste passando, para que uma semana sem tempo não quebre nada.

**Regras de ritmo:** uma etapa por sessão sempre que possível; ao parar no meio, anote o próximo passo no PR. Nunca comece uma sessão sem saber o "pronto quando" da etapa.

### Marco 0: preparação (3 sessões)

| Etapa | O que fazer | Pronto quando |
| --- | --- | --- |
| 0.1 | Registrar a autorização dos XMLs reais e o combinado de titularidade com a Centi (fora do código) | Registro escrito guardado; linha do escopo atualizada |
| 0.2 | Baixar os pacotes de XSD de 01/07/2026 e 26/10/2026; comparar namespaces; ver se o XSD do evento exige assinatura; conferir no MOS a composição do `Id` do evento | Respostas registradas nas decisões D-07, D-08 e D-10 |
| 0.3 | Criar o repositório privado: Next.js 16, TypeScript, Tailwind, Vitest 5, ESLint com a fronteira do `core`, CI (lint, tipos, testes), Node 22, `local-data/` no `.gitignore`. Exportar este documento para `docs/` | CI verde num PR vazio |

### Marco 1: núcleo no terminal (8 sessões)

| Etapa | O que fazer | Pronto quando |
| --- | --- | --- |
| 1.1 | `ingest/`: ler pasta e zip (fflate), abrir o envelope do lote, identificar o evento pelo namespace, aplicar os limites do RNF-06 | `audit-cli` lista quantos eventos de cada tipo há num lote real |
| 1.2 | `xsd/`: validador com libxml2-wasm e o pacote real, carregado da memória; regra sobre a assinatura (D-08) | R001 roda nos XMLs reais sem erro falso |
| 1.3 | `parse/` do S-1010, S-1200, S-1210 e S-2299; `model/montar.ts`; `totais()` | Testes com o XML anonimizado e com o construtor de modelo passam |
| 1.4 | Motor, registro e formato do achado (item 3) | Teste de contrato do catálogo passa com uma regra vazia |
| 1.5 | Regras R002, R003 e R009 pelas fichas da seção 11 | Cada uma com XML que dispara e XML limpo; lote com resultado esperado |
| 1.6 | Rodar nos XMLs reais; medir tempo e anotar falsos positivos; saída em CSV | CSV de achados de uma competência real revisado por você |

### Marco 2: validação com o mercado (em paralelo, fora do código)

Pesquisa de concorrentes, 5 a 10 entrevistas e 2 ou 3 pilotos usando o CSV do Marco 1, como no escopo. **Portão:** só seguir para o Marco 3 com o sinal verde do escopo (3 pessoas dizem que pagariam e um piloto achou um erro real que não tinha visto).

### Marco 3: auditoria no navegador (7 sessões)

| Etapa | O que fazer | Pronto quando |
| --- | --- | --- |
| 3.1 | Worker com comlink; tela de upload; progresso por etapa; cancelar | RNF-04 atendido no lote grande sintético |
| 3.2 | Relatório: resumo, "fora da auditoria" e lista por trabalhador virtualizada | Critérios de aceite HU-02 (seção 7) |
| 3.3 | Cartão do achado e "ver no XML" relendo o arquivo | HU-03 |
| 3.4 | Visões por regra e por causa | HU-04 |
| 3.5 | Estados de erro e de vazio (seção 7) | Cada estado com teste de ponta a ponta |
| 3.6 | Teste de privacidade (RNF-13), CSP (RNF-14) e desempenho (RNF-01 e RNF-02) no CI | Os três testes no CI, verdes |

### Marco 4: catálogo completo (7 sessões)

Parsers do S-1202, S-1207 e S-1299 e as regras restantes, duas por sessão, na ordem: R008, R011, R013, R014, R005, R007, R010, R004, R006 e R012. As quatro últimas dependem das decisões D-11 e D-10. **Pronto quando:** as 14 regras passam no teste de contrato e no lote com resultado esperado.

### Marco 5: exportações (3 sessões)

Excel para a equipe e PDF para o cliente, conforme a seção 7, carregados só quando usados. **Pronto quando:** RNF-08 atendido e os dois arquivos conferidos por você.

### Marco 6: conta e histórico (6 sessões)

Autenticação, Prisma com Neon, API de achados, histórico, ignorar com motivo e "foi útil?" (seção 8). **Pronto quando:** HU-05 e HU-06 aceitas e RNF-13 continua verde com o salvamento ligado.

### Marco 7: MVP com pilotos (contínuo)

Termos de uso e política de privacidade, aviso de ferramenta de apoio, plano pago da Vercel antes da primeira cobrança, 2 ou 3 pilotos gratuitos e medição do RNF-19 (falso positivo por regra).

## 7. Especificação funcional

**Regra geral da entrada: o que não dá para auditar nunca some em silêncio.** Ou bloqueia com motivo claro, ou entra na lista "fora da auditoria" do relatório.

### 7.1 Regras de entrada e casos de borda

| Caso | Decisão |
| --- | --- |
| `.xml` soltos ou um `.zip`, vários de uma vez | Aceita |
| Zip dentro de zip | Abre um nível; mais fundo que isso, lista como fora da auditoria |
| Arquivo que não é XML | Ignora e lista |
| Evento fora dos sete do MVP, inclusive retornos (S-5001 etc.) | Ignora e lista como "evento fora do MVP" |
| Namespace de versão diferente de S-1.3 | Evento não auditado; listado como "leiaute não suportado" |
| Um arquivo com vários eventos no envelope do lote | Cada evento é tratado separadamente; a origem guarda arquivo e posição |
| Mais de um empregador (raiz) no lote | Bloqueia e mostra as raízes encontradas; o MVP audita uma empresa por vez |
| Mais de uma competência nos periódicos | Mostra as competências encontradas e pede para escolher uma; o resto vira fora da auditoria |
| Apuração mensal e anual (13º) juntas | Pede para escolher uma; uma auditoria por par competência + apuração |
| S-1010 e S-2299 (não periódicos) | Entram todos os do lote, sem filtro de competência; a validade da rubrica decide se vale para a competência |
| S-3000 (exclusão) no lote | Fora do MVP; aviso no cabeçalho: "exclusões não consideradas" |
| Mesmo evento duas vezes (mesmo Id) | Conta uma vez e gera um achado Info |
| Original e retificador do mesmo trabalhador e período | Os dois ficam no modelo; regras de valor (R002, R013, R014) usam o retificador mais recente; R005 e R006 olham todos |
| XML sem assinatura digital | Aceito (decisão D-08, a confirmar no XSD) |
| Encoding diferente de UTF-8 | Tenta pela declaração do XML; se falhar, vira achado R001 |
| Lote acima dos limites do RNF-06 | Recusa antes de processar, com o limite na mensagem |
| S-1210 de outra competência (regime de caixa: folha de 09 paga em 10) | Aceita S-1210 com perApur N ou N+1 no mesmo lote e liga cada pagamento ao demonstrativo por perRef. Demonstrativo de N sem pagamento porque o S-1210 de N+1 não veio vira um Info agrupado. Hipótese: conferir perApur e perRef do S-1210 no MOS. |

### 7.2 Histórias e critérios de aceite

**HU-01 · Enviar o lote.** Como analista de DP, quero soltar os XMLs da competência para auditar sem enviar nada ao servidor.

- Dado um zip válido, quando eu solto o arquivo, então vejo o progresso por etapa (lendo, validando, montando, auditando) com contagem.
- Dado um lote em andamento, quando clico em cancelar, então tudo para em até 1 s e volto à tela inicial.
- Dado um lote com problema de entrada (7.1), então vejo o motivo antes de qualquer processamento pesado.

**HU-02 · Ver o resultado.** Quero entender em segundos o tamanho do problema.

- Então vejo empresa, competência, apuração, pacote de XSD, totais por severidade, trabalhadores sem achado e o bloco "fora da auditoria".
- Então a lista por trabalhador vem ordenada pela maior severidade e permite buscar por nome, CPF ou matrícula.

**HU-03 · Entender um achado.**

- Então o cartão mostra o que vimos (com valores), por que importa, como corrigir e onde está (arquivo, evento, campo).
- Quando clico em "ver no XML", então vejo o trecho com o campo destacado, lido do arquivo local.

**HU-04 · Corrigir em massa.**

- Então a visão por causa agrupa achados que vêm da mesma rubrica e mostra quantos uma correção resolve.
- Então a visão por regra lista as regras com a quantidade de achados de cada uma.

**HU-05 · Ignorar com motivo.**

- Quando ignoro um achado e escrevo o motivo, então ele sai das contagens e vai para o filtro "ignorados".
- Dado o mesmo achado (mesma chave) numa auditoria futura, então ele já aparece como ignorado, com o motivo e o autor.

**HU-06 · Histórico.**

- Então vejo as auditorias da conta por competência e empresa, com totais.
- Quando abro uma auditoria antiga, então vejo os achados salvos, com CPF mascarado; "ver no XML" fica indisponível, com explicação.

**HU-07 · Exportar.** Quando exporto, então recebo o arquivo no formato da seção 7.4, gerado no navegador.

**HU-08 · Entrar.** Quando entro, então vejo só as auditorias da minha conta; a auditoria em si funciona mesmo sem login, mas sem salvar.

### 7.3 Estados de erro e de vazio

| Situação | Mensagem (essência) | Ação oferecida |
| --- | --- | --- |
| Navegador sem suporte | "Este navegador não consegue auditar. Use Chrome, Edge, Firefox ou Safari atualizados." | Link para a lista |
| Zip corrompido | "Não consegui abrir este arquivo." | Tentar outro arquivo |
| Nenhum evento do MVP no lote | "Nenhum dos 7 eventos auditados foi encontrado." | Lista do que foi encontrado |
| Lote grande demais | "Este lote passa do limite de N." | Dividir o lote |
| Todos os XMLs reprovados no XSD | "Nenhum XML passou na validação de esquema." | Ver os erros R001 |
| Nenhum achado | "Nenhum problema encontrado nas 14 regras." com o bloco "fora da auditoria" | Exportar o comprovante em PDF |
| Falha ao salvar o histórico | "O relatório está pronto, mas não foi salvo." | Tentar de novo (automático ao voltar a conexão) |
| Regra que falhou na execução | Linha no bloco "fora da auditoria": "R0xx não executada" | Nenhuma; registrar o erro sem dado pessoal |
| Histórico vazio | "Sua primeira auditoria aparece aqui." | Nova auditoria |

### 7.4 Exportações

**PDF para o cliente:** capa com empresa, competência, data e aviso de ferramenta de apoio; resumo por severidade; causas principais; achados por trabalhador com o que vimos e como corrigir; bloco "fora da auditoria". CPF sempre mascarado. Acima de 2.000 achados, o PDF traz só o resumo e as causas.

**Excel para a equipe:** aba "Achados" com uma linha por achado e as colunas severidade, regra, título, trabalhador, CPF mascarado, matrícula, evento, arquivo, campo, esperado, encontrado, diferença, causa e status (aberto ou ignorado); aba "Resumo"; aba "Fora da auditoria". Primeira linha congelada e filtros ligados.

## 8. Dados, API e autenticação

**O servidor guarda só o resultado: conta, empresas, auditorias, achados com CPF mascarado, ignorados e feedback.** Mesmo assim, valores e matrícula ligados a um CPF mascarado ainda são dado pessoal, então tudo aqui segue a seção 9.

**Nome do trabalhador não existe no MVP.** O S-1200 traz CPF e matrícula, mas não o nome (o nome vem do S-2200, fora do MVP). O relatório identifica a pessoa por CPF e matrícula; os nomes do protótipo são ilustrativos (decisão D-15).

### Autenticação

Recomendação: [better-auth](https://www.npmjs.com/package/better-auth) 1.7.12 (estável, aceita Next 16 e Prisma 7), com login por link no e-mail enviado pelo [Resend](https://www.npmjs.com/package/resend) 6.34.1. Não há senha para guardar, e o plugin de organizações atende o multiempresa da Fase 3. Alternativa: NextAuth, que você já usou, mas a versão 5 continua em beta e a estável é a 4.24 (decisão D-14). Versões conferidas no npm em 22/10/2026.

### Modelo do banco (Prisma, rascunho)

As tabelas de usuário, sessão e verificação vêm da biblioteca de autenticação. Abaixo, só as do domínio.

```prisma
enum Severidade { ERRO ALERTA INFO }
enum Apuracao { MENSAL ANUAL }

model Conta {
  id            String   @id @default(cuid())
  nome          String
  retencaoMeses Int      @default(12)
  criadaEm      DateTime @default(now())
  empresas      Empresa[]
  auditorias    Auditoria[]
  ignorados     AchadoIgnorado[]
}

model Empresa {
  id            String @id @default(cuid())
  contaId       String
  tipoInscricao String
  raiz          String // texto: CNPJ alfanumérico
  nome          String
  conta         Conta  @relation(fields: [contaId], references: [id])
  auditorias    Auditoria[]
  @@unique([contaId, raiz])
}

model Auditoria {
  id                 String   @id @default(cuid())
  contaId            String
  empresaId          String
  competencia        String   // "2026-09"
  apuracao           Apuracao
  leiaute            String   // "S-1.3"
  pacoteXsd          String   // "2026-07-01"
  totalTrabalhadores Int
  totalEventos       Int
  regras             Json     // [{codigo, versao}] que rodaram
  foraDaAuditoria    Json
  criadaPor          String   // id do usuário
  criadaEm           DateTime @default(now())
  conta              Conta    @relation(fields: [contaId], references: [id])
  empresa            Empresa  @relation(fields: [empresaId], references: [id])
  achados            Achado[]
  @@index([contaId, empresaId, competencia])
}

model Achado {
  id           String     @id @default(cuid())
  auditoriaId  String
  regra        String     // "R002"
  regraVersao  Int
  severidade   Severidade
  chave        String     // HMAC (item 3)
  cpfMascarado String?    // "***.456.789-**"
  matricula    String?
  evento       String     // "S-1210"
  eventoId     String
  arquivo      String     // nome saneado
  campo        String?
  valores      Json       // em centavos
  causa        String?    // ex.: "rubrica:1050|001"
  auditoria    Auditoria  @relation(fields: [auditoriaId], references: [id], onDelete: Cascade)
  @@index([auditoriaId])
  @@index([chave])
}

model AchadoIgnorado {
  id       String   @id @default(cuid())
  contaId  String
  chave    String
  motivo   String
  autorId  String
  criadoEm DateTime @default(now())
  conta    Conta    @relation(fields: [contaId], references: [id])
  @@unique([contaId, chave])
}

model Feedback {
  id          String   @id @default(cuid())
  contaId     String
  chave       String
  regra       String
  regraVersao Int
  util        Boolean
  criadoEm    DateTime @default(now())
  @@index([regra, regraVersao])
}
```

- **Nome do arquivo saneado:** se o nome tiver uma sequência de 11 dígitos (possível CPF), ela é mascarada antes de sair do navegador.
- **Segredo da chave:** não fica no banco. A chave de cada conta é derivada de um segredo mestre do servidor + id da conta e entregue só a usuários logados daquela conta. Sem login, o "ignorar" vale só na sessão.

### API (route handlers)

| Método e rota | Para quê | Regras |
| --- | --- | --- |
| `POST /api/auditorias` | Salvar o resultado de uma auditoria | Payload validado com zod; até 2 MB e 20.000 achados; o servidor recusa se achar 11 dígitos seguidos em qualquer campo de texto |
| `GET /api/auditorias` | Histórico, com filtro por empresa e competência | Paginado |
| `GET /api/auditorias/:id` | Uma auditoria com achados | Achados paginados |
| `DELETE /api/auditorias/:id` | Excluir uma auditoria | Apaga achados em cascata |
| `GET /api/ignorados` | Chaves ignoradas da conta, antes de mostrar o relatório | — |
| `PUT /api/ignorados` | Ignorar com motivo (`chave`, `motivo`) | Motivo obrigatório, até 500 caracteres |
| `DELETE /api/ignorados/:chave` | Desfazer o ignorar | — |
| `POST /api/feedback` | "Foi útil?" | Um por chave e usuário |
| `GET /api/conta/chave` | Chave HMAC da conta para o navegador | Só com sessão |

Toda rota exige sessão e filtra por `contaId` numa extensão do Prisma, com teste que tenta ler dados de outra conta.

## 9. Segurança e LGPD

**A principal defesa é a arquitetura: o XML não sai do navegador. O maior risco que sobra é código malicioso rodando na própria página, que leria os XMLs na memória.** Por isso CSP e controle de dependências vêm antes de qualquer outra medida.

### Ameaças e medidas

| Ameaça | Medida |
| --- | --- |
| Script de terceiro ou XSS lendo os XMLs na memória | CSP do RNF-14; nenhum script, fonte ou análise de terceiros nas páginas de auditoria (fontes servidas pelo próprio domínio via `next/font`); nada de `dangerouslySetInnerHTML` com conteúdo do XML; "ver no XML" renderiza como texto |
| Dependência comprometida | Lockfile versionado; versões exatas para as bibliotecas do `core`; `npm audit` e Dependabot no CI; nova dependência só com licença MIT, Apache ou BSD e revisão |
| Dado pessoal chegando ao servidor por engano | Teste do RNF-13; servidor recusa payload com 11 dígitos seguidos; nome de arquivo saneado |
| Vazamento do banco | Nenhum CPF completo no banco; chave HMAC com segredo fora do banco; achados apagados após o prazo de retenção |
| Uma conta vendo dados de outra | Filtro por `contaId` obrigatório na extensão do Prisma e teste de isolamento |
| Sessão roubada | Link de login válido por 15 minutos; cookie `httpOnly`, `secure`, `SameSite=Lax`; sessão expira em 7 dias sem uso |
| Dado pessoal em logs | Nunca registrar corpo de requisição; erros do navegador enviados só com código, etapa e regra |
| XML real no repositório | `local-data/` no `.gitignore` e checagem no CI que falha com `.xml` fora de `fixtures/` |

### Segredos (variáveis de ambiente na Vercel, nunca no repositório)

`DATABASE_URL`, `AUTH_SECRET`, `HMAC_MASTER_KEY`, `RESEND_API_KEY`. Trocar o `HMAC_MASTER_KEY` invalida os "ignorados" existentes, então a troca exige rotina de migração.

### Papéis e documentos

- **Papéis:** o cliente (escritório ou órgão) é o controlador; você é o operador dos achados salvos. Sem login, nada é salvo e nenhum dado pessoal é tratado no servidor.
- **Antes do primeiro piloto:** política de privacidade, termos de uso com o aviso de ferramenta de apoio e contrato de operador (o que é tratado, finalidade, retenção, exclusão, incidentes).
- **Direitos do titular:** e-mail de contato; para localizar dados de um CPF, o servidor calcula a chave com o segredo da conta e apaga os achados correspondentes. Prazo de resposta: o do RNF-15, a conferir na LGPD.
- **Incidente:** avisar o cliente controlador imediatamente, porque é ele quem comunica a ANPD. Conferir o prazo da regulamentação atual da ANPD.
- **Região dos dados:** preferir banco e funções em São Paulo. Conferir a disponibilidade da região na Neon e na Vercel; fora do país, a transferência internacional precisa constar na política.

### XMLs reais no seu ambiente

Só em `local-data/`, com o disco do notebook criptografado. Não anexar XML real em issue, PR, chat ou ferramenta de IA; usar a versão anonimizada. A cópia do S-1200 real enviada neste projeto pode ser apagada da pasta de uploads, agora que existe a versão anonimizada.

## 10. Processo de desenvolvimento

Objetivo: que cada sessão curta de trabalho termine com algo integrado e verde, sem depender de memória do que estava pela metade.

### 10.1 Repositório e branches

- Repositório **privado** no GitHub desde o primeiro commit (há fixtures e regras internas; XML real nunca entra, ver seção 9).
- `main` sempre verde e implantável. Nada é commitado direto nela.
- Uma branch por passo do plano (seção 6), com o código do passo no nome: `etapa/1.3-parse-s1200`, `etapa/3.2-regra-r002`.
- PR pequeno (meta: até \~400 linhas de diff, sem contar fixtures), merge por *squash*, título no formato `[1.3] Parse do S-1200 para o DTO`.
- Mesmo trabalhando sozinho, abra PR: é onde o CI roda e onde fica o registro do porquê.

### 10.2 Integração contínua (GitHub Actions)

Um workflow `ci.yml` em todo PR e push na `main`, Node 22:

1. `npm ci`
2. `npm run lint` (ESLint, incluindo a regra que proíbe React/Next/Prisma dentro de `src/core`)
3. `npm run typecheck` (`tsc --noEmit`)
4. `npm test -- --coverage` (Vitest; cobertura mínima de 90% em `src/core/rules` e 80% no resto de `src/core`)
5. `npm run build`
6. Verificação de segredo e de dado real: falha se algum arquivo versionado tiver um CPF válido fora da lista de CPFs fictícios permitidos das fixtures (script simples em `scripts/checar-dados-reais.ts`).

A partir do Marco 5, um segundo job com Playwright: teste de privacidade (nenhuma requisição com conteúdo de XML sai do navegador), cabeçalhos CSP e o teste de desempenho do perfil típico (RNF-01).

Deploy: a Vercel cria preview por PR e publica a `main`. Migrações do Prisma rodam num passo separado e manual (`prisma migrate deploy`) até existir cliente pagante.

### 10.3 Definição de pronto

Um passo está pronto quando:

- O código e os testes do nível certo (seção 3, cinco níveis) estão no PR e o CI está verde.
- Se mexeu numa regra: a ficha da regra (seção 11) foi atualizada no mesmo PR, e a `versao` da regra foi incrementada quando o comportamento mudou.
- Nenhum XML real, CPF real ou CNPJ real foi versionado.
- Se uma decisão foi tomada ou mudou, o Registro de decisões (fim deste doc) foi atualizado.
- O `CHANGELOG.md` tem uma linha para o que muda para o usuário.

### 10.4 Versões

- SemVer em `0.x` até o primeiro cliente pagante. Sobe o *minor* quando entra regra nova ou muda o relatório; o *patch* para correção.
- Cada regra tem a própria `versao` (inteiro). O achado guarda `regra@versao`, então um relatório antigo continua explicável depois que a regra muda.
- O pacote XSD usado fica registrado na auditoria (`pacoteXsd`, data do pacote).

### 10.5 Processo de Nota Técnica (mudança no leiaute)

O eSocial publica pacotes XSD novos com o mesmo nome de versão (seção 4). Rotina:

1. **Vigiar**: uma vez por semana, olhar a página de documentação técnica do eSocial no gov.br. Mais tarde isso pode virar um job que compara a lista de pacotes.
2. **Baixar** o pacote novo para `schemas/xsd/S-1.3/<AAAA-MM-DD>/` (data de produção do pacote), sem apagar os anteriores.
3. **Comparar**: rodar `scripts/diff-xsd.ts` entre o pacote novo e o anterior, e anotar no PR os campos e restrições que mudaram nos eventos do escopo.
4. **Testar**: rodar a suíte inteira com o pacote novo e, localmente, a regressão real (nível 5).
5. **Ajustar** regras afetadas (ficha + `versao` + `leiautes.pacoteAte` na versão antiga e `pacoteDe` na nova).
6. **Publicar antes** da data de produção do pacote. A escolha do pacote por competência segue a decisão D-09.

### 10.6 Ambiente de trabalho

- Node 22 LTS (ou 24), npm. `.nvmrc` no repositório.
- `.env.example` com as variáveis sem valores; `.env.local` nunca versionado.
- `local-data/` no `.gitignore` desde o primeiro commit, com um `README` explicando que ali ficam os XMLs reais e que a pasta nunca sai da máquina.
- Um `CLAUDE.md` curto na raiz apontando para este documento, para a seção 11 e para as regras de dados reais. Ajuda quando usar um assistente no código.

### 10.7 Ritmo sugerido

Com pouco tempo livre: sessões de 1 a 2 horas, um passo do plano por sessão. Ao fim de cada sessão, ou o PR está mergeado, ou a branch tem um commit `wip:` e uma nota de 2 linhas no PR dizendo onde parou.

## 11. Fichas das regras

Cada ficha é o contrato da regra: o teste de contrato do catálogo (nível 3) confere que toda regra implementada tem ficha, e toda mudança de comportamento atualiza a ficha no mesmo PR.

**Legenda dos campos.** ✅ = confirmado no S-1200 real (seção "Conferência com um S-1200 real"). ⚠️ = nome ou caminho **a conferir no leiaute S-1.3** antes de codificar. Nenhum campo ⚠️ deve virar código sem essa conferência.

**Formato.** Objetivo · Eventos e campos · Condição · Não dispara quando · Severidade · Exemplo · Sugestão ao usuário · Pendências.

**Regras gerais de todas as fichas:**

- A regra só olha eventos que passaram no XSD (R001). Evento reprovado vira achado de R001 e sai do resto da auditoria.
- Quando houver retificação no lote, a regra olha a versão vigente do evento (a última retificação), salvo quando a ficha disser outra coisa.
- Valores em centavos inteiros. Comparação de dinheiro é exata, sem tolerância, salvo quando a ficha disser outra coisa.
- Trabalhador identificado por CPF + matrícula (D-15). Nome não existe no S-1200.

### R001 · XML fora do esquema (Erro)

- **Objetivo:** apontar arquivo que o eSocial rejeitaria por estrutura.
- **Eventos e campos:** todos os do escopo. Validação contra o pacote XSD escolhido para a competência (D-09).
- **Condição:** a libxml2 retorna erro de validação. Um achado por arquivo, com até 5 mensagens e linha/coluna.
- **Não dispara quando:** falta a assinatura digital, se o XSD permitir validar sem ela (D-08). XML que nem é bem-formado vira erro de entrada (seção 7.3), não R001.
- **Exemplo:** `vrRubr` com vírgula decimal.
- **Sugestão:** corrigir na folha e gerar o XML de novo; não editar o XML na mão.
- **Pendências:** D-07 (estrutura dos pacotes), D-08 (assinatura).

### R002 · Líquido pago diferente do demonstrativo (Erro)

- **Objetivo:** pegar diferença entre o que o S-1210 diz que pagou e o que o demonstrativo do S-1200/S-1202/S-1207 fecha.
- **Eventos e campos:** S-1200 ✅ `cpfTrab`, `ideDmDev`, `codRubr`, `ideTabRubr`, `vrRubr`, `perApur`. S-1210 ⚠️ `cpfBenef`, `perRef`, `ideDmDev`, `vrLiq`, `dtPgto`. S-1010 ⚠️ `tpRubr` (provento, desconto, informativa).
- **Condição:** liga pagamento e demonstrativo por CPF + `perRef` + `ideDmDev`. Soma todos os pagamentos do mesmo demonstrativo (pode haver mais de um `infoPgto`). Dispara se soma dos líquidos ≠ proventos − descontos, calculados por `totais()`.
- **Não dispara quando:** o demonstrativo não tem pagamento no lote (isso é R011). Nenhum S-1210 no lote: um único Info "pagamentos não enviados" em vez de um achado por trabalhador.
- **Severidade:** Erro. Rebaixa para Alerta quando alguma rubrica do demonstrativo não tem cadastro no S-1010 do lote, porque aí não dá para saber se é provento ou desconto.
- **Exemplo:** demonstrativo fecha R$ 3.150,00, S-1210 pagou R$ 3.210,00.
- **Sugestão:** procurar rubrica paga fora da folha ou adiantamento não descontado; retificar o evento errado.
- **Pendências:** regime de caixa (S-1210 de N+1, ver 7.1) e se `vrLiq` existe no S-1.3 ou se o líquido é calculado. Conferir no MOS.

### R003 · Remuneração depois do desligamento (Erro)

- **Objetivo:** pegar folha mensal de quem já saiu.
- **Eventos e campos:** S-2299 ⚠️ `cpfTrab`, `matricula`, `dtDeslig`. S-1200 ✅ `infoPerApur`, `matricula`, `perApur`.
- **Condição:** existe S-2299 no lote com a mesma matrícula e `dtDeslig` anterior ao primeiro dia da competência, e o S-1200 tem `infoPerApur` para essa matrícula.
- **Não dispara quando:** a remuneração está só em período anterior (diferenças retroativas são legítimas). Desligamento dentro da competência. Matrícula diferente do mesmo CPF (pode ser outro vínculo).
- **Exemplo:** desligado em 15/08/2026 com `infoPerApur` em 09/2026.
- **Sugestão:** se a verba é rescisória, ela vai no S-2299; excluir ou retificar o S-1200.
- **Pendências:** confirmar onde fica o grupo de período anterior no S-1.3.

### R004 · CPF com dígito verificador inválido (Erro)

- **Objetivo:** pegar CPF digitado errado antes do envio.
- **Eventos e campos:** S-1200 ✅ `cpfTrab`; S-1210 ⚠️ `cpfBenef`; S-1202, S-1207, S-2299 ⚠️.
- **Condição:** cálculo módulo 11 falha, ou os 11 dígitos são iguais.
- **Não dispara quando:** o XSD já reprovou o campo (fica só o R001).
- **Exemplo:** 529.982.247-24.
- **Sugestão:** corrigir o cadastro do trabalhador e gerar o evento de novo.
- **Pendências:** D-11 (o eSocial já rejeita; a regra vale para lote ainda não enviado).

### R005 · Mais de um evento original (Erro)

- **Objetivo:** pegar duplicidade de envio.
- **Eventos e campos:** S-1200, S-1202, S-1207, S-1210 com ✅ `indRetif` = 1, `perApur`, `ideEmpregador`, CPF.
- **Condição:** dois ou mais eventos do mesmo tipo com `indRetif` = 1 para o mesmo empregador, CPF, `perApur` e `indApuracao`.
- **Não dispara quando:** o mesmo arquivo aparece duas vezes no lote (mesmo `Id`): vira aviso de entrada (7.3), não R005.
- **Sugestão:** manter um original e transformar os outros em retificação ou exclusão.
- **Pendências:** conferir a chave de unicidade no MOS (no S-1207, CPF do beneficiário e `nrBeneficio` ⚠️).

### R006 · Retificação sem recibo (Erro)

- **Objetivo:** pegar retificação que o eSocial não conseguiria ligar ao original.
- **Eventos e campos:** ✅ `indRetif` = 2; ⚠️ `nrRecibo`.
- **Condição:** `indRetif` = 2 e `nrRecibo` ausente ou vazio.
- **Não dispara quando:** o XSD já exige o campo e reprovou (fica só o R001).
- **Sugestão:** informar o recibo do evento original.
- **Pendências:** D-11. Se o XSD exigir o recibo de forma condicional, a regra só cobre o que o XSD não cobre.

### R007 · Mesma matrícula no S-1200 e no S-1202 (Erro)

- **Objetivo:** pegar vínculo informado como celetista e como servidor RPPS ao mesmo tempo.
- **Eventos e campos:** S-1200 ✅ `matricula`; S-1202 ⚠️ `matricula` (caminho a conferir).
- **Condição:** mesma combinação empregador + CPF + matrícula + `perApur` nos dois eventos.
- **Não dispara quando:** CPF igual com matrículas diferentes (servidor com dois vínculos é normal).
- **Sugestão:** definir o regime do vínculo e excluir o evento errado.
- **Pendências:** confirmar com caso real se órgão público manda servidor RPPS no S-1200 com categoria 302 (o S-1200 real tinha 302, ver D-15 e seção de conferência).

### R008 · Rubrica sem cadastro no S-1010 (Alerta)

- **Objetivo:** pegar rubrica usada na folha que não está na tabela de rubricas.
- **Eventos e campos:** S-1200/S-1202/S-1207 ✅ `codRubr`, `ideTabRubr`. S-1010 ⚠️ `codRubr`, `ideTabRubr`, `iniValid`, `fimValid`.
- **Condição:** o par `codRubr` + `ideTabRubr` não tem S-1010 no lote com validade que cubra a competência. Um achado por rubrica (agrupado por causa), não por trabalhador.
- **Não dispara quando:** **o lote não tem nenhum S-1010.** Aí sai um único Info: "Tabela de rubricas não enviada; as regras R002, R008, R009, R010 e R013 ficaram limitadas". É o caso comum: o S-1010 costuma ser enviado uma vez e não volta em todo lote.
- **Exemplo:** rubrica `2210` aparece em 12 demonstrativos e não está no S-1010.
- **Sugestão:** cadastrar ou reativar a rubrica no S-1010 antes de reenviar a folha.
- **Pendências:** decidir se o usuário pode subir "tabela de rubricas de referência" separada do lote (pós-MVP).

### R009 · Incidência incoerente com a natureza (Alerta)

- **Objetivo:** pegar rubrica com natureza remuneratória sem incidência de INSS, IRRF ou FGTS, ou o contrário.
- **Eventos e campos:** S-1010 ⚠️ `natRubr`, `tpRubr`, `codIncCP`, `codIncIRRF`, `codIncFGTS`.
- **Condição:** a combinação natureza → incidência não está entre as esperadas numa **tabela curada** (`src/core/rules/catalog/R009/tabela-natureza.ts`), montada pelo Alex a partir da Tabela 03 e do MOS. Cada linha da tabela tem fonte e data.
- **Não dispara quando:** a natureza não está na tabela curada (silêncio, não achado). Sem S-1010 no lote (ver R008).
- **Exemplo:** natureza de salário-base com `codIncCP` de "não incide".
- **Sugestão:** revisar a incidência da rubrica no S-1010; se for exceção legítima (decisão judicial), ignorar com motivo.
- **Pendências:** a tabela curada é o maior trabalho de domínio do projeto. Começar pelas 20 naturezas mais usadas nos clientes.

### R010 · Incidência RGPS em servidor RPPS (Alerta)

- **Objetivo:** pegar servidor de regime próprio com rubrica que gera contribuição ao INSS.
- **Eventos e campos:** S-1202 (ou S-1200 com categoria de servidor) ⚠️; S-1010 ⚠️ `codIncCP`, `codIncCPRP`.
- **Condição:** trabalhador com categoria RPPS (lista de códigos de categoria a conferir na Tabela 01) tem rubrica com `codIncCP` de incidência.
- **Não dispara quando:** sem S-1010 no lote; categoria fora da lista.
- **Sugestão:** conferir o regime do vínculo e a incidência da rubrica.
- **Pendências:** confirmar quais categorias são RPPS e se a 302 pode ser RGPS (comissionado) ou RPPS.

### R011 · Remuneração sem pagamento ou pagamento sem remuneração (Alerta)

- **Objetivo:** pegar demonstrativo esquecido no S-1210 ou pagamento de demonstrativo que não existe.
- **Eventos e campos:** os de R002.
- **Condição:** demonstrativo sem pagamento ligado (CPF + `perRef` + `ideDmDev`), ou pagamento cujo `ideDmDev` não existe em nenhum demonstrativo do lote.
- **Não dispara quando:** o lote não tem S-1210 (um Info só, ver R002). Pagamento de competência anterior (`perRef` < competência auditada), porque o demonstrativo está em outro lote.
- **Regime de caixa:** a folha de 09 paga em 10 vem num S-1210 de `perApur` 10. A auditoria aceita S-1210 de `perApur` N e N+1 e liga por `perRef` (ver 7.1). Se o usuário subir só a competência N, os demonstrativos pagos em N+1 viram um Info agrupado, não alertas.
- **Sugestão:** enviar o pagamento ou corrigir o `ideDmDev`.
- **Pendências:** confirmar no MOS o significado de `perApur` e `perRef` no S-1210.

### R012 · Evento periódico depois do fechamento (Alerta)

- **Objetivo:** pegar evento gerado depois do S-1299 da mesma competência, que seria rejeitado sem reabertura.
- **Eventos e campos:** ✅ `Id` do evento; S-1299 ⚠️ `perApur`, `indApuracao`.
- **Condição:** a data e hora de geração lida do `Id` (D-10) é posterior à do `Id` do S-1299 da mesma competência.
- **Não dispara quando:** sem S-1299 no lote; `Id` fora do formato esperado (vira Info "não foi possível verificar").
- **Sugestão:** enviar S-1298 (reabertura), o evento, e fechar de novo.
- **Pendências:** D-10. Se o MOS não garantir o formato do `Id`, a regra sai do MVP.

### R013 · Descontos maiores que proventos (Alerta)

- **Objetivo:** pegar demonstrativo com líquido negativo.
- **Eventos e campos:** os de R002 (S-1200) e S-1010 ⚠️ `tpRubr`.
- **Condição:** em `totais()`, descontos > proventos no mesmo demonstrativo.
- **Não dispara quando:** alguma rubrica sem cadastro (não dá para classificar).
- **Sugestão:** conferir descontos lançados em duplicidade ou provento faltando.

### R014 · Ativo com remuneração zerada (Info)

- **Objetivo:** chamar atenção para vínculo que parece ativo mas não teve valor.
- **Eventos e campos:** S-1200 ✅ `vrRubr`, `matricula`.
- **Condição:** demonstrativo com soma de proventos = 0 e sem S-2299 no lote para a matrícula. "Ativo" quer dizer só isso no MVP: o Auditor não tem o S-2200 nem afastamentos (S-2230).
- **Não dispara quando:** há S-2299 da matrícula no lote.
- **Sugestão:** conferir afastamento, licença sem vencimento ou falta de lançamento.
- **Pendências:** quando o S-2230 entrar no escopo, a regra passa a ignorar afastados.

## Requisitos não funcionais

**Proposta: o MVP audita até 5.000 trabalhadores (cerca de 10.500 XMLs) em no máximo 60 segundos num notebook comum de escritório e aceita até 20.000 trabalhadores como limite.** A medição abaixo mostra folga para isso. Os números são metas iniciais e precisam ser calibrados com o tamanho real dos seus XMLs.

### Perfis de lote

| Perfil | Quem | Trabalhadores | XMLs (aprox.) | Descompactado (aprox.) |
| --- | --- | --- | --- | --- |
| Típico | Empresa pequena ou média de escritório | até 300 | 900 | 2 MB |
| Grande (meta do MVP) | Prefeitura média, empresa grande | até 5.000 | 10.500 | 30 MB |
| Limite | Prefeitura grande | até 20.000 | 42.000 | 120 MB |

A conta usa dois XMLs por trabalhador (remuneração e pagamento), cerca de 300 rubricas no S-1010 e 5 KB por XML de remuneração com 40 rubricas. Acima do limite, o sistema recusa o lote antes de processar, com mensagem clara.

**Máquina de referência (hipótese):** notebook com 8 GB de RAM, processador de 4 núcleos de 2018 em diante (ex.: Core i5 de 8ª geração), Windows 10 ou 11 e Chrome ou Edge atual. Todas as metas de tempo valem para ela.

### O que medi

Rodei hoje um lote sintético em Node 22, num servidor de 4 núcleos a 2,8 GHz, com fflate, libxml2-wasm e fast-xml-parser nas versões do item 4.

| Etapa | 1.000 trabalhadores (2.300 XMLs, 5 MB) | 5.000 trabalhadores (10.300 XMLs, 26 MB) |
| --- | --- | --- |
| Descompactar | 0,1 s | 0,4 s |
| XSD (só remuneração) | 0,3 s | 1,2 s |
| Leitura do XML | 1,0 s | 4,0 s |
| Modelo + uma regra | 0,03 s | 0,09 s |
| Memória do processo | 159 MB | 222 MB |

O lote grande levou cerca de 6 segundos. Mesmo supondo o navegador 3 vezes mais lento e um XSD oficial mais pesado, sobra margem para os 60 segundos. **A leitura com fast-xml-parser é a etapa mais lenta**, mais que o XSD. Se for preciso otimizar, dá para extrair os dados do mesmo documento que a libxml2-wasm já abriu para validar, sem ler o XML duas vezes.

Limites da medição: XMLs e XSD sintéticos (não os oficiais), Node em vez de navegador, e uma única regra.

### Desempenho e capacidade

| ID | Requisito | Meta | Como verificar |
| --- | --- | --- | --- |
| RNF-01 | Tempo do lote típico, do arquivo solto ao relatório | até 10 s | Teste de desempenho com lote sintético, no navegador, na máquina de referência |
| RNF-02 | Tempo do lote grande | até 60 s | Idem |
| RNF-03 | Tempo do lote no limite | até 180 s | Idem |
| RNF-04 | Tela não trava durante a auditoria | Nenhuma tarefa acima de 100 ms na thread principal; progresso atualizado ao menos 1 vez por segundo; cancelar responde em até 1 s | Painel de desempenho do navegador durante o teste do lote grande |
| RNF-05 | Memória da aba | até 600 MB no lote grande e 1,5 GB no limite. O XML bruto não fica guardado: "ver no XML" relê o arquivo quando pedido | Medidor de memória do navegador no mesmo teste |
| RNF-06 | Proteção contra arquivo malicioso ou grande demais | Recusar zip com mais de 150 MB descompactado, mais de 50.000 arquivos, taxa de compressão acima de 100:1 ou XML individual acima de 10 MB | Testes com zip-bomba e arquivos fora do limite |
| RNF-07 | Relatório com muitos achados | Lista de 10.000 achados rola sem travar; filtro e busca respondem em até 300 ms | Teste com lote sintético cheio de erros plantados |
| RNF-08 | Exportação | PDF com 1.000 achados em até 20 s; Excel com 10.000 linhas em até 10 s. Acima de 2.000 achados, o PDF sugere o resumo por causa | Teste cronometrado |

### Compatibilidade

| ID | Requisito | Meta | Como verificar |
| --- | --- | --- | --- |
| RNF-09 | Navegadores com suporte completo | Chrome e Edge nas duas últimas versões estáveis, testados a cada entrega. Firefox e Safari nas duas últimas, testados a cada versão do produto | Testes de ponta a ponta em Chromium no CI; checagem manual nos outros |
| RNF-10 | Navegador sem suporte | Sem WebAssembly ou worker de módulo, mostra aviso antes do upload em vez de falhar no meio. A libxml2-wasm pede no mínimo Chrome e Edge 89 e Safari 15 | Teste com a detecção desligada |
| RNF-11 | Celular | Consultar histórico e relatório a partir de 360 px de largura; auditoria em celular fora do MVP, com aviso | Teste visual em 360 px |
| RNF-12 | Resolução de trabalho | Uso completo a partir de 1280 × 720 | Teste visual |

### Privacidade e segurança

| ID | Requisito | Meta | Como verificar |
| --- | --- | --- | --- |
| RNF-13 | Nenhum XML sai do computador | 0 bytes de XML e nenhum CPF completo (11 dígitos) nas requisições durante e depois da auditoria | Teste de ponta a ponta que intercepta toda a rede e falha se achar XML ou CPF completo |
| RNF-14 | Política de segurança de conteúdo (CSP) | Scripts só do próprio domínio, com `wasm-unsafe-eval` para o WebAssembly; nenhum script de terceiros nas páginas de auditoria | Teste que lê os cabeçalhos da resposta |
| RNF-15 | Retenção dos achados | 12 meses por padrão, configurável por conta; exclusão a pedido do titular em até 15 dias | Rotina de limpeza testada; prazo a conferir na LGPD |

### Confiabilidade e precisão

| ID | Requisito | Meta | Como verificar |
| --- | --- | --- | --- |
| RNF-16 | Auditoria não depende do servidor | Com a página carregada, auditoria e exportação funcionam sem internet. Salvar no histórico tenta de novo quando a conexão volta | Teste com a rede desligada |
| RNF-17 | Resultado determinístico | Mesma entrada, mesmo resultado na mesma ordem, sempre | Teste do lote com resultado esperado (item 3) |
| RNF-18 | Precisão de valores | Diferença mínima detectada de R$ 0,01; nenhuma conta de dinheiro em ponto flutuante | Testes de unidade com valores na borda |
| RNF-19 | Falso positivo | No máximo 10% de "não foi útil" por regra nos pilotos; acima disso a regra volta para revisão | Contagem do "foi útil?" por regra |
| RNF-20 | Disponibilidade do servidor | 99,5% ao mês (cerca de 3,6 h fora). É aceitável porque a auditoria não depende dele | Monitor de disponibilidade externo |

### Usabilidade e manutenção

| ID | Requisito | Meta | Como verificar |
| --- | --- | --- | --- |
| RNF-21 | Acessibilidade | WCAG 2.1 AA; fluxo completo por teclado; contraste mínimo de 4,5:1 | Verificação automática com axe sem violações sérias e teste manual de teclado |
| RNF-22 | Primeira auditoria sem ajuda | Usuário novo chega ao relatório em até 5 minutos, sem tutorial | Teste com os pilotos |
| RNF-23 | Novo pacote de XSD | Suportado antes da data em que o pacote entra em produção | Checklist do processo de Nota Técnica |
| RNF-24 | Qualidade do núcleo | Cobertura de linhas de `src/core` de pelo menos 90%; toda regra com XML que dispara e XML limpo; CI em até 5 min | Relatório de cobertura e tempo do CI |
| RNF-25 | Peso da página | Carga inicial até 250 KB compactados; WebAssembly e geração de PDF carregados só quando usados | Relatório do build |

### Fatos, hipóteses e o que verificar

**Fatos:** a medição acima; os requisitos mínimos de navegador da libxml2-wasm (item 4).

**Hipóteses:** 5 KB por XML de remuneração; 300 rubricas por empresa; máquina de referência típica de escritório; navegador até 3 vezes mais lento que o Node; teto de 10% de falso positivo.

**Verificar:**

- **Com os seus XMLs reais:** número de arquivos, tamanho total e rubricas por remuneração do maior lote (o S-1202 de servidor pode ser bem maior que o S-1200). Esses três números recalibram a tabela de perfis.
- O computador típico dos escritórios e órgãos piloto. Se for mais fraco, as metas de tempo sobem, não o limite.
- O prazo de resposta ao titular na LGPD (RNF-15).
- Os termos de uso da Vercel: o plano gratuito é para uso não comercial, então a primeira cobrança exige plano pago.

## Conferência com um S-1200 real

**Um XML de envio real, de 22/10/2026, confirmou quatro hipóteses e mudou três pontos do desenho.** As maiores mudanças: o evento vem dentro do envelope do lote, sem assinatura digital, e a matrícula fica por estabelecimento e lotação, não no demonstrativo. É um único arquivo, com um evento e três rubricas, então tudo abaixo vale para este exemplo até aparecerem mais.

### O que o XML mostra

| Ponto | Era | O XML mostra | Impacto |
| --- | --- | --- | --- |
| Envelope | Hipótese: evento solto ou dentro do lote | Dentro do lote de envio (`envioLoteEventos` > `eventos` > `evento`), com `ideEmpregador`, `ideTransmissor` e atributo `grupo` | `ingest/` abre o envelope e trata cada `evento` como um evento. Um arquivo pode ter vários eventos; conferir o máximo por lote no MOS |
| Versão | Hipótese: versão no namespace | Namespace do evento termina em `v_S_01_03_00`; o do lote, em `v1_1_1` | Confirma o achado do item 4: o XML diz "S-1.3", mas não qual pacote de XSD. O pacote continua escolhido por data |
| Assinatura | Item 4: "conferir se o XSD exige a assinatura" | **Não há assinatura digital** no arquivo | Se o XSD do evento exigir a assinatura, a R001 reprovaria todo XML exportado assim. Decisão: validar ignorando a ausência da assinatura (e avisar uma vez no cabeçalho), depois de conferir o XSD |
| Campos de identificação | Lista "a conferir" do item 2 | Confirmados: `indRetif`, `indApuracao`, `perApur`, `cpfTrab`, `ideDmDev`, `codCateg`, `matricula`, `codRubr`, `ideTabRubr`, `vrRubr` | Esses saem da lista de pendências |
| Matrícula | Item 2: `matricula` no demonstrativo | Fica em `infoPerApur` > `ideEstabLot` > `remunPerApur`, junto com estabelecimento e lotação | **Muda o modelo:** o demonstrativo passa a ter uma lista de grupos (estabelecimento, lotação, matrícula, itens). A R007 compara matrículas nesses grupos |
| Item de rubrica | Item 2: `quantidade` | Traz `fatorRubr` e `indApurIR`; `qtdRubr` não aparece neste exemplo | `ItemRubrica` ganha `fator` e `indApurIR` (código cru); `quantidade` continua opcional |
| Empregador | Item 2: uma inscrição | Empregador com raiz de 8 dígitos; estabelecimento com 14 | Modelo separa empregador (raiz) e estabelecimento. Os dois como texto, por causa do CNPJ alfanumérico |
| Id do evento | Não tratado | O `Id` parece trazer inscrição, data e hora de geração e um sequencial | **Pode salvar a R012:** comparar a hora de geração do evento com a do S-1299 sem precisar do recibo. Conferir a composição do Id no MOS antes de usar |
| Servidor no S-1200 | Item 2: regime vem do evento | Categoria 302 num S-1200, de um órgão público | Confirma: órgão público também manda S-1200, e o regime vem do evento, não do tipo de cliente. Conferir o significado da categoria na Tabela 01 |
| Tamanho | Item RNF: 5 KB e 40 rubricas por XML | 1,6 KB com 3 rubricas, um evento por arquivo | As metas do RNF ficam conservadoras. Ainda preciso dos números do maior lote |

### Arquivo de teste anonimizado

Criei s1200-lote-anonimizado.xml com a mesma estrutura: CPF e CNPJ fictícios com dígito verificador válido, valores redondos, ambiente de homologação (`tpAmb` 2) e sistema "TESTE". O fast-xml-parser já lê esse arquivo e chega ao evento, à matrícula e às três rubricas. Ele pode ser o primeiro XML do gerador de testes e da R001.

### Próximos XMLs que mais ajudam

Um S-1210 da mesma pessoa e competência, um S-1010 das rubricas 2, 10 e 61, um S-1202 de servidor estatutário e um S-1299. Com eles dá para fechar as regras 2, 8, 9 e 12 contra dados reais.

## Registro de decisões

Uma linha por decisão. Mudou de ideia? Atualize a linha, com a data, em vez de apagar.

| Código | Decisão | Estado |
| --- | --- | --- |
| D-01 | App Next.js único, núcleo puro em `src/core` sem React/Next/Prisma (item 1) | Decidido 21/10/2026 |
| D-02 | Processamento no navegador (Web Worker); servidor guarda só achados com CPF mascarado. Plano B: API C#/.NET | Decidido (escopo) |
| D-03 | Modelo em duas camadas (DTO por versão → canônico), Pessoa por CPF, Demonstrativo no centro (item 2) | Decidido 21/10/2026 |
| D-04 | Regra = metadados + `executar` puro; achado sem textos, `chave` HMAC por conta (item 3) | Decidido 21/10/2026 |
| D-05 | Bibliotecas e versões do item 4; Prisma fixo em 7.10.1; Node 22/24 | Decidido 21/10/2026 |
| D-06 | Dinheiro em centavos inteiros; nunca `parseFloat` | Decidido 21/10/2026 |
| D-07 | Estrutura de `schemas/xsd/S-1.3/<data>/` e script de diff entre pacotes | Aberto: depende de baixar os pacotes |
| D-08 | Validar XSD sem assinatura digital (o S-1200 real veio sem) | Aberto: conferir se o XSD aceita |
| D-09 | Qual pacote XSD usar: pela competência do lote ou pela data de envio. Recomendação: pela data de geração do `Id`, com opção de trocar na tela | Aberto |
| D-10 | R012 pela data/hora de geração no `Id` do evento | Aberto: conferir formato do Id no MOS |
| D-11 | R004 e R006 duplicam validações do eSocial; mantê-las para lote ainda não enviado | Aberto, recomendação: manter |
| D-12 | Nome "Pente Fino" | Aberto: busca no INPI e domínios |
| D-13 | Direção visual B, marca-texto: fundo papel #FAF8F2, tinta #1E1D1A, grifo #FFE45C, Manrope + JetBrains Mono, menu no topo. Severidade continua por cor + forma | Decidido 22/10/2026 (Alex) |
| D-14 | Autenticação: better-auth + link mágico por e-mail (Resend) | Aberto, recomendação feita (item 8) |
| D-15 | MVP sem nome do trabalhador: identificação por CPF mascarado + matrícula (nome só vem no S-2200, fora do escopo) | Decidido 22/10/2026 |

## Pendências fora do código

Coisas que só você consegue resolver. Nenhuma bloqueia o Marco 0; as marcadas com ⚠️ bloqueiam o marco indicado.

- [ ] ⚠️ Marco 1: baixar os pacotes XSD S-1.3 no gov.br (este ambiente não consegue baixar) e colocar em `schemas/xsd/S-1.3/<data>/`.
- [ ] ⚠️ Marco 2: conferir no leiaute/MOS os campos marcados ⚠️ nas fichas, começando por S-1210 (`perApur`, `perRef`, `vrLiq`) e S-1010 (`tpRubr`, `natRubr`, incidências).
- [ ] ⚠️ Marco 3: montar a tabela curada natureza → incidência da R009 (começar pelas 20 naturezas mais usadas).
- [ ] Medir o maior lote real: número de arquivos, MB, trabalhadores e rubricas por S-1202. Valida os perfis dos RNF.
- [ ] Conseguir mais XMLs reais (só em `local-data/`): S-1210 do mesmo trabalhador e competência, S-1010 das rubricas usadas, um S-1202 e um S-1299.
- [ ] Apagar o XML real que foi enviado nesta conversa depois de guardá-lo em `local-data/`.
- [ ] Busca no INPI (classes 9 e 42) e domínios para o nome.
- [ ] Validar o protótipo clicável da direção B (D-13) com 2 ou 3 analistas de DP.
- [ ] Antes do primeiro cliente: plano comercial da Vercel (o Hobby não permite uso comercial), região São Paulo no Neon/Vercel, prazos de retenção e texto de privacidade (item 9).

## Glossário

- **Achado:** um problema encontrado por uma regra, ligado a um trabalhador e a um evento.
- **Causa:** agrupamento de achados que se resolvem com uma correção só (por exemplo, uma rubrica do S-1010).
- **Competência / perApur:** o mês (ou ano, no 13º) a que a folha se refere.
- **Demonstrativo (`ideDmDev`):** o recibo de pagamento de um trabalhador dentro de um S-1200/S-1202/S-1207.
- **DTO do evento:** os dados do XML como vieram, por versão de leiaute, antes de virar o modelo canônico.
- **Lote:** o conjunto de XMLs que o usuário solta na tela para uma auditoria.
- **MOS:** Manual de Orientação do eSocial.
- **NT:** Nota Técnica, que costuma trazer pacote XSD novo.
- **Pacote XSD:** um conjunto de esquemas publicado pelo eSocial, identificado aqui pela data de produção.
- **Regime de caixa:** o S-1210 informa o pagamento no mês em que ele ocorreu, que pode ser o mês seguinte ao da folha.
- **RGPS / RPPS:** regime geral (INSS) e regime próprio dos servidores.
- **Rubrica:** um item da folha (salário, hora extra, desconto), cadastrado no S-1010.
