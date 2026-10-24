import { describe, expect, it } from 'vitest';
import { compararAchados } from './comparar';

const cab = '﻿severidade;regra;detalhes;chave';
const csv = (...linhas: string[]) => [cab, ...linhas].join('\r\n') + '\r\n';

describe('compararAchados', () => {
  it('separa novos, resolvidos, mudados e iguais pela chave', () => {
    const base = csv('erro;R002;x=1;aaa', 'erro;R003;y=1;bbb', 'alerta;R009;z=1;ccc');
    const atual = csv('erro;R002;x=1;aaa', 'erro;R003;y=2;bbb', 'info;R002;w=1;ddd');
    expect(compararAchados(base, atual)).toEqual({
      novos: ['info;R002;w=1;ddd'],
      resolvidos: ['alerta;R009;z=1;ccc'],
      mudaram: ['erro;R003;y=2;bbb'],
      iguais: 1,
    });
  });

  it('recusa CSV sem a coluna chave', () => {
    expect(() => compararAchados('a;b\r\n', csv())).toThrow('chave');
  });
});
