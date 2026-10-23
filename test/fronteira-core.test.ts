// Prova que a fronteira do src/core (CLAUDE.md) é checada pelo ESLint, não por disciplina.
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function regrasVioladas(codigo: string, arquivo = 'src/core/exemplo.ts'): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: arquivo });
  return (resultado?.messages ?? []).map((m) => m.ruleId ?? 'parse');
}

describe('fronteira do src/core', () => {
  // A primeira chamada carrega os plugins do ESLint (alguns segundos a frio).
  beforeAll(() => regrasVioladas(''), 60_000);

  it.each([
    ["import { useState } from 'react';"],
    ["import Link from 'next/link';"],
    ["import { PrismaClient } from '@prisma/client';"],
    ["import { readFile } from 'node:fs';"],
    ["import { Botao } from '@/shared/botao';"],
    ["import { x } from '../features/upload/x';"],
  ])('recusa %s', async (codigo) => {
    expect(await regrasVioladas(codigo)).toContain('no-restricted-imports');
  });

  it('aceita import de dentro do core', async () => {
    const codigo =
      "import { mascararCpf } from '@/core/findings/cpf';\nexport const m = mascararCpf;";
    expect(await regrasVioladas(codigo)).not.toContain('no-restricted-imports');
  });

  it('recusa DOM e parseFloat', async () => {
    expect(await regrasVioladas('export const t = document.title;')).toContain(
      'no-restricted-globals',
    );
    expect(await regrasVioladas("export const v = parseFloat('1.5');")).toContain(
      'no-restricted-globals',
    );
  });

  it('recusa Number() e Number.parseFloat', async () => {
    expect(await regrasVioladas("export const v = Number('1.5');")).toContain(
      'no-restricted-syntax',
    );
    expect(await regrasVioladas("export const v = Number.parseFloat('1.5');")).toContain(
      'no-restricted-syntax',
    );
  });

  it('não vale fora do core', async () => {
    const codigo = "import { useState } from 'react';\nexport const u = useState;";
    expect(await regrasVioladas(codigo, 'src/features/x.ts')).not.toContain(
      'no-restricted-imports',
    );
  });
});
