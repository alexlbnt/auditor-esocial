import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

// Fronteira do src/core: domínio puro, roda igual no navegador, no worker,
// no Vitest e no terminal. Nada de React, Next, Prisma, DOM ou outra camada.
const fronteiraDoCore = {
  files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'react', message: 'src/core é puro: sem React.' },
          { name: 'react-dom', message: 'src/core é puro: sem React.' },
          { name: 'next', message: 'src/core é puro: sem Next.' },
          { name: '@prisma/client', message: 'src/core é puro: sem Prisma.' },
          { name: 'prisma', message: 'src/core é puro: sem Prisma.' },
        ],
        patterns: [
          { group: ['react/*', 'react-dom/*', 'next/*', '@prisma/*'], message: 'src/core é puro.' },
          { group: ['node:*'], message: 'src/core roda no navegador: sem módulos do Node.' },
          {
            group: ['@/*', '!@/core', '!@/core/*'],
            message: 'src/core só importa de src/core.',
          },
          {
            group: ['**/app/**', '**/features/**', '**/server/**', '**/shared/**', '**/workers/**'],
            message: 'src/core só importa de src/core.',
          },
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch'].map(
        (name) => ({ name, message: 'src/core é puro: sem DOM nem rede.' }),
      ),
      { name: 'parseFloat', message: 'Dinheiro em centavos: use paraCentavos().' },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='Number']",
        message:
          'Dinheiro em centavos: use paraCentavos(). Fora de dinheiro, justifique com eslint-disable.',
      },
      {
        selector: "MemberExpression[object.name='Number'][property.name='parseFloat']",
        message: 'Dinheiro em centavos: use paraCentavos().',
      },
    ],
  },
};

const config = [
  ...nextVitals,
  ...nextTs,
  prettier,
  fronteiraDoCore,
  {
    ignores: ['.next/**', 'coverage/**', 'node_modules/**', 'local-data/**', 'next-env.d.ts'],
  },
];

export default config;
