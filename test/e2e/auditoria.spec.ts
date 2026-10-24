import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { loteGrande } from './lotes.ts';

const FIXTURE_R002 = 'src/core/rules/catalog/R002-liquido-pagamento/fixtures/dispara.xml';

async function abrir(page: Page) {
  await page.goto('/auditorias/nova');
  await expect(page.getByTestId('estado-validador')).toHaveText(/Validador pronto/, {
    timeout: 60_000,
  });
}

test('HU-01: audita um lote no navegador e mostra o resumo', async ({ page }) => {
  await abrir(page);
  await expect(page.getByText('Os arquivos são lidos no seu computador.')).toBeVisible();
  await page.getByTestId('entrada-de-arquivos').setInputFiles({
    name: 'lote.xml',
    mimeType: 'text/xml',
    buffer: readFileSync(FIXTURE_R002),
  });
  await expect(page.getByRole('heading', { name: 'Competência 09/2026' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId('total-erro')).toContainText('1');
  await expect(page.getByText('2026-10-26')).toBeVisible();
});

test('HU-01: cancelar para em até 1 s e volta à tela inicial', async ({ page }) => {
  await abrir(page);
  await page.getByTestId('entrada-de-arquivos').setInputFiles({
    name: 'grande.zip',
    mimeType: 'application/zip',
    buffer: loteGrande(2000),
  });
  await expect(page.getByTestId('etapa-validando')).toHaveAttribute('data-estado', 'atual', {
    timeout: 60_000,
  });
  const inicio = Date.now();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Auditoria cancelada. Nada foi salvo.')).toBeVisible({
    timeout: 1_000,
  });
  expect(Date.now() - inicio).toBeLessThanOrEqual(1_000);
  // E dá para auditar de novo.
  await expect(page.getByTestId('estado-validador')).toHaveText(/Validador pronto/, {
    timeout: 60_000,
  });
});

// RNF-04 no lote grande: pesado demais para o CI agora (entra na 3.6). Rodar com PERF=1.
test('RNF-04: tela não trava e o progresso anda pelo menos 1 vez por segundo', async ({ page }) => {
  test.skip(!process.env.PERF, 'só com PERF=1');
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    const w = window as unknown as { tarefasLongas: number[]; atualizacoes: number[] };
    w.tarefasLongas = [];
    w.atualizacoes = [];
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) w.tarefasLongas.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
    new MutationObserver(() => w.atualizacoes.push(performance.now())).observe(document, {
      subtree: true,
      characterData: true,
      childList: true,
    });
  });
  await abrir(page);
  // Pelo caminho no disco, como o usuário: com `buffer`, o próprio Playwright copia os
  // 6 MB para a página na thread da tela e gera uma tarefa longa que não é do app.
  const lote = join(mkdtempSync(join(tmpdir(), 'pente-fino-')), 'grande.zip');
  writeFileSync(lote, loteGrande(5000));
  await page.evaluate(() => {
    const w = window as unknown as { tarefasLongas: number[]; atualizacoes: number[] };
    w.tarefasLongas = [];
    w.atualizacoes = [];
  });
  const inicio = Date.now();
  await page.getByTestId('entrada-de-arquivos').setInputFiles(lote);
  await expect(page.getByRole('heading', { name: 'Competência 09/2026' })).toBeVisible({
    timeout: 240_000,
  });
  const duracao = Date.now() - inicio;
  const { tarefasLongas, atualizacoes } = await page.evaluate(() => {
    const w = window as unknown as { tarefasLongas: number[]; atualizacoes: number[] };
    return { tarefasLongas: w.tarefasLongas, atualizacoes: w.atualizacoes };
  });
  const lacunas = atualizacoes.slice(1).map((t, i) => t - (atualizacoes[i] ?? t));
  const maiorTarefa = Math.max(0, ...tarefasLongas);
  const maiorLacuna = Math.max(0, ...lacunas);
  console.log(
    `RNF-04: ${(duracao / 1000).toFixed(1)} s; maior tarefa na tela ${maiorTarefa.toFixed(0)} ms; ` +
      `maior intervalo sem atualizar ${maiorLacuna.toFixed(0)} ms; ${atualizacoes.length} atualizações`,
  );
  expect(maiorTarefa, 'nenhuma tarefa acima de 100 ms na thread da tela').toBeLessThanOrEqual(100);
  expect(maiorLacuna, 'progresso pelo menos 1 vez por segundo').toBeLessThanOrEqual(1_000);
  expect(duracao, 'RNF-02: lote grande em até 60 s').toBeLessThanOrEqual(60_000);
});
