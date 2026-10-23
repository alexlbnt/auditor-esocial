// Catálogo de regras do MVP, em ordem de código. Toda regra daqui passa pelo
// teste de contrato (test/catalogo.test.ts).
import { R001 } from './catalog/R001-xml-fora-do-esquema/rule.ts';
import type { Regra } from './tipos.ts';

export const REGRAS: readonly Regra[] = Object.freeze([R001]);
