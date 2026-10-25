// Gera lotes FICTÍCIOS de demonstração em .demo/ (fora do git), para testar a tela:
//   node scripts/gerar-demo.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { loteDoRelatorio, loteGrande } from '../test/e2e/lotes.ts';

mkdirSync('.demo', { recursive: true });
writeFileSync('.demo/01-um-erro-de-cada-regra.xml', loteDoRelatorio());
writeFileSync('.demo/02-grande-5000-trabalhadores.zip', loteGrande(5000));
writeFileSync('.demo/03-grande-com-diferenca-de-liquido.zip', loteGrande(2000, '3999.99'));
console.log('Lotes fictícios em .demo/');
