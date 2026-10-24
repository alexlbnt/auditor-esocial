import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { loteDoRelatorio, loteGrande } from './lotes.ts';

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
  await page.getByRole('button', { name: 'Erro' }).click(); // desliga Erro
  await expect(page.getByTestId('contagem-visivel')).toHaveText('Mostrando 1 de 4 achado(s).');
  await expect(page.getByRole('button', { name: 'Erro' })).toHaveAttribute('aria-pressed', 'false');
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
  await page.getByRole('button', { name: 'Erro' }).click();
  await expect(page.getByTestId('contagem-visivel')).toHaveText('Mostrando 0 de 10.000 achado(s).');
  const filtro = Date.now() - inicio;
  const longas = await page.evaluate(() => (window as unknown as { longas: number[] }).longas);
  console.log(
    `RNF-07: filtro em ${filtro} ms; maior tarefa ${Math.max(0, ...longas).toFixed(0)} ms`,
  );
  expect(filtro).toBeLessThanOrEqual(300);
  expect(Math.max(0, ...longas)).toBeLessThanOrEqual(100);
});
