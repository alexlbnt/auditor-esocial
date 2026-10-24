# local-data/

Aqui ficam os XMLs **reais** autorizados, só nesta máquina (disco criptografado).

- Tudo nesta pasta, exceto este README, está no `.gitignore` e nunca é commitado.
- Não copie nada daqui para fixtures, testes, issues, PRs, chats ou ferramentas de IA.
- `npm run audit:local` audita os XMLs daqui e grava o resultado em `.resultado/` (CSV com CPF mascarado).
  - `.segredo` guarda o segredo da chave dos achados, criado na primeira execução. Ele deixa a chave estável entre execuções; não compartilhe.
  - Para criar a linha de base depois de revisar: copie `.resultado/` para `.linha-de-base/`. As próximas execuções mostram achados novos, resolvidos e mudados, e terminam com erro se algo mudou.
  - Pastas e arquivos que começam com `.` não são lidos como entrada.
