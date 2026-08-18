/**
 * `npm run seed --workspace @iceberg/seed -- [archivo.json]`
 *
 * Escribe el dataset a JSON y muestra un resumen para revisarlo a ojo.
 */

import { writeFileSync } from 'node:fs';
import { dates, money } from '@iceberg/core';
import { generateSeed, totalOf } from './generate.js';

const target = process.argv[2];
const dataset = generateSeed();

const ingreso = totalOf(dataset, 'ingreso');
const gasto = totalOf(dataset, 'gasto');
const neto = money.subtract(ingreso, gasto);
const tasa = money.ratio(neto, ingreso);

console.log(`semilla        ${dataset.seed}`);
console.log(`rango          ${dates.formatDate(dataset.range.start)} a ${dates.formatDate(dataset.range.end)}`);
console.log(`movimientos    ${dataset.transactions.length}`);
console.log(`categorias     ${dataset.categories.join(', ')}`);
console.log(`ingreso        ${money.format(ingreso)}`);
console.log(`gasto          ${money.format(gasto)}`);
console.log(`neto           ${money.formatSigned(neto)}`);
console.log(`tasa de ahorro ${tasa === null ? 'n/a' : `${(tasa * 100).toFixed(1)}%`}`);

if (target) {
  writeFileSync(target, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  console.log(`\nescrito en ${target}`);
}
