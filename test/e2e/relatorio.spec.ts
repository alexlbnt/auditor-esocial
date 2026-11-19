import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { loteComCausaComum, loteDoRelatorio, loteGrande } from './lotes.ts';

async function auditar(page: Page, buffer: Buffer, nome = 'lote.xml') {
  await page.goto('/auditorias/nova');
  await expect(page.getByTestId('estado-validador')).toHaveText(/Validador pronto/, {
    timeout: 60_000,
  });
  // Pelo disco, como o usuário (ver ADR 0009).
  const caminho = join(mkdtempSync(join(tmpdir(), 'pente-fino-')), nome);
  writeFileSync(caminho, buffer);
  await page.getByTestId('entrada-de-arquivos').setInputFiles(caminho);
  await expect(page.getByRole('heading', { name: 'Competência 09/2026' })).toBeVisible({
    timeout: 240_000,
  });
}

test('HU-02: cabeçalho, totais, comece por aqui, lista por trabalhador e fora da auditoria', async ({
  page,
}) => {
  await auditar(page, loteDoRelatorio());
  await expect(page.getByTestId('total-erro')).toContainText('3'); // R001, R002 (A), R003 (B)
  await expect(page.getByTestId('total-alerta')).toContainText('1'); // R002 rebaixada (B)
  await expect(page.getByText('1 trabalhador(es) sem nenhum achado.')).toBeVisible();
  // Nenhuma correção resolve 2 achados neste lote: sem "Comece por aqui".
  await expect(page.getByTestId('comece-por-aqui')).toHaveCount(0);

  // Ordem: pior severidade e depois mais achados -> B (2 achados), Lote (R001), A.
  const lista = page.getByTestId('lista-virtual');
  await expect(lista.getByRole('listitem').first()).toContainText('***.000.002-**');
  await expect(lista).toContainText('Desligado em 15/08/2026, mas tem folha de 09/2026.');
  await expect(lista).toContainText(
    'O S-1210 pagou R$ 2.760,00, mas o demonstrativo fecha em R$ 2.700,00.',
  );
  await expect(lista).toContainText('Lote e cadastros');

  await page.getByLabel('Buscar por CPF, matrícula ou regra').fill('R003');
  await expect(page.getByTestId('contagem-visivel')).toHaveText('Mostrando 1 de 4 achado(s).');
  await page.getByLabel('Buscar por CPF, matrícula ou regra').fill('');
  await page.getByRole('button', { name: 'Erro', exact: true }).click(); // desliga Erro
  await expect(page.getByTestId('contagem-visivel')).toHaveText('Mostrando 1 de 4 achado(s).');
  await expect(page.getByRole('button', { name: 'Erro', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('RNF-07: 10.000 achados rolam sem travar e o filtro responde em até 300 ms', async ({
  page,
}) => {
  test.skip(!process.env.PERF, 'só com PERF=1');
  test.setTimeout(400_000);
  await page.addInitScript(() => {
    const w = window as unknown as { longas: number[] };
    w.longas = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.longas.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
  await auditar(page, loteGrande(10_000, '9999.99'), 'grande.zip');
  await expect(page.getByTestId('contagem-visivel')).toHaveText(
    'Mostrando 10.000 de 10.000 achado(s).',
  );
  // Sem zerar: a medição cobre a chegada dos 10.000 achados, a primeira renderização,
  // a rolagem e o filtro.

  const lista = page.getByTestId('lista-virtual');
  for (let i = 0; i < 20; i++) await lista.evaluate((el) => el.scrollBy(0, 4000));
  const inicio = Date.now();
  await page.getByRole('button', { name: 'Erro', exact: true }).click();
  await expect(page.getByTestId('contagem-visivel')).toHaveText('Mostrando 0 de 10.000 achado(s).');
  const filtro = Date.now() - inicio;
  const longas = await page.evaluate(() => (window as unknown as { longas: number[] }).longas);
  console.log(
    `RNF-07: filtro em ${filtro} ms; maior tarefa ${Math.max(0, ...longas).toFixed(0)} ms`,
  );
  expect(filtro).toBeLessThanOrEqual(300);
  expect(Math.max(0, ...longas)).toBeLessThanOrEqual(100);
});

test('HU-03: cartão do achado, ver no XML com a linha destacada e navegação', async ({ page }) => {
  await auditar(page, loteDoRelatorio());
  await page.getByTestId('linha-achado').filter({ hasText: 'R$ 2.760,00' }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao).toBeVisible();
  await expect(cartao.getByRole('heading', { level: 2 })).toHaveText(
    'O S-1210 pagou R$ 2.760,00, mas o demonstrativo fecha em R$ 2.700,00. Diferença de R$ 60,00.',
  );
  await expect(cartao.locator('mark')).toHaveText(['R$ 2.760,00', 'R$ 2.700,00', 'R$ 60,00']);
  await expect(cartao).toContainText('R002 v1');
  for (const secao of [
    'O que vimos',
    'Por que importa',
    'Como corrigir',
    'Onde está',
    'Ver no XML',
  ]) {
    await expect(cartao.getByRole('heading', { name: secao })).toBeVisible();
  }
  await expect(cartao).toContainText('***.000.001-** · matr. 0001');

  await cartao.getByRole('button', { name: 'Mostrar o trecho do XML' }).click();
  const destaque = cartao.getByTestId('trecho-xml').locator('[data-destaque]');
  await expect(destaque).toContainText('<vrLiq>2760.00</vrLiq>');
  // Como texto: a tag aparece escrita, não vira elemento da página.
  await expect(cartao.getByTestId('trecho-xml').locator('vrliq')).toHaveCount(0);

  const posicao = cartao.getByText(/^\d+ de 4$/);
  const antes = await posicao.textContent();
  await cartao.getByRole('button', { name: 'Próximo →' }).click();
  await expect(cartao.getByText(/^\d+ de 4$/)).not.toHaveText(antes ?? '');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('HU-03: R001 mostra as mensagens do esquema e o campo no XML', async ({ page }) => {
  await auditar(page, loteDoRelatorio());
  await page.getByTestId('linha-achado').filter({ hasText: 'R001' }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: 'Mensagens do esquema' })).toBeVisible();
  await cartao.getByRole('button', { name: 'Mostrar o trecho do XML' }).click();
  await expect(cartao.getByTestId('trecho-xml').locator('[data-destaque]')).toContainText(
    '<cpfTrab>1234567890</cpfTrab>',
  );
});

test('HU-04: visões por causa e por regra, com busca e teclado nas abas', async ({ page }) => {
  await auditar(page, loteComCausaComum());
  await expect(page.getByTestId('comece-por-aqui')).toHaveText(
    'Corrija a rubrica 77 (tabela 001) e resolva 3 achados.',
  );

  await page.getByRole('tab', { name: 'Por causa' }).click();
  await expect(page.getByRole('tab', { name: 'Por causa' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const lista = page.getByTestId('lista-virtual');
  const primeiro = lista.getByRole('listitem').first();
  await expect(primeiro).toContainText('Corrija a rubrica 77 (tabela 001)');
  await expect(primeiro).toContainText('resolve 3 achado(s)');
  await expect(lista).toContainText('Achados sem causa comum');

  await page.getByRole('tab', { name: 'Por regra' }).click();
  await expect(lista.getByRole('listitem').first()).toContainText(
    'R002 · Líquido pago diferente do demonstrativo',
  );
  await page.getByLabel('Buscar por CPF, matrícula ou regra').fill('000.004'); // o que aparece de ***.000.004-**;
  await expect(page.getByTestId('contagem-visivel')).toHaveText('Mostrando 1 de 4 achado(s).');
  await page.getByLabel('Buscar por CPF, matrícula ou regra').fill('');

  // Teclado: setas trocam de aba.
  await page.getByRole('tab', { name: 'Por regra' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Por trabalhador' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Por trabalhador' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Por causa' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
