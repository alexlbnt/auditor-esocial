// Catálogo de regras do MVP, em ordem de código. Toda regra daqui passa pelo
// teste de contrato (test/catalogo.test.ts).
import { R001 } from './catalog/R001-xml-fora-do-esquema/rule.ts';
import { R002 } from './catalog/R002-liquido-pagamento/rule.ts';
import { R003 } from './catalog/R003-remuneracao-apos-desligamento/rule.ts';
import { R009 } from './catalog/R009-incidencia-natureza/rule.ts';
import type { Regra } from './tipos.ts';

export const REGRAS: readonly Regra[] = Object.freeze([R001, R002, R003, R009]);
