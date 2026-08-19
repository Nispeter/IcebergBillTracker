/**
 * `npm run seed --workspace @iceberg/seed -- [archivo.json]`
 *
 * Escribe el dataset a JSON y muestra un resumen para revisarlo a ojo.
 */

import { writeFileSync } from 'node:fs';
import { categories, dates, money } from '@iceberg/core';
import { gastoPorCategoria, generateSeed, saldoActual, totalOf } from './generate';

const target = process.argv[2];
const dataset = generateSeed();

const ingreso = totalOf(dataset, 'ingreso');
const gasto = totalOf(dataset, 'gasto');
const neto = money.subtract(ingreso, gasto);
const tasa = money.ratio(neto, ingreso);
const meses = 18;

console.log(`semilla        ${dataset.seed}`);
console.log(`rango          ${dates.formatDate(dataset.range.start)} a ${dates.formatDate(dataset.range.end)}`);
console.log(`movimientos    ${dataset.transactions.length}`);
console.log(`ingreso        ${money.format(ingreso)}   ${money.format(money.divide(ingreso, meses))}/mes`);
console.log(`gasto          ${money.format(gasto)}   ${money.format(money.divide(gasto, meses))}/mes`);
console.log(`neto           ${money.formatSigned(neto)}   lo que quedo en la cuenta`);
console.log(`saldo inicial  ${money.format(money.money(dataset.saldoInicialMinor))}`);
console.log(`plata restante ${money.format(saldoActual(dataset))}`);

// El aporte a inversion sale de la cuenta como cualquier gasto, asi que el
// "neto" de arriba lo cuenta como plata que se fue. Ahorro real = neto + aporte.
const invertido = money.sum(
  dataset.transactions
    .filter((tx) => tx.category === 'ahorros')
    .map((tx) => money.money(tx.amountMinor)),
);
const ahorroReal = money.ratio(money.add(neto, invertido), ingreso);
console.log(`invertido      ${money.format(invertido)}   ${money.format(money.divide(invertido, meses))}/mes`);
console.log(`ahorro real    ${ahorroReal === null ? 'n/a' : `${(ahorroReal * 100).toFixed(1)}%`}   neto + aporte a inversion`);
console.log(`  del cual sobrante en cuenta: ${tasa === null ? 'n/a' : `${(tasa * 100).toFixed(1)}%`}`);

console.log('');
console.log('gasto por categoria');
for (const { categoria, total } of gastoPorCategoria(dataset.transactions)) {
  const nombre = categories.categoryName(categoria);
  const porMes = money.divide(total, meses);
  const parte = money.ratio(total, gasto);
  const pct = parte === null ? '' : `${(parte * 100).toFixed(1)}%`;
  console.log(`  ${nombre.padEnd(34)}${money.format(total).padStart(13)}${money.format(porMes).padStart(12)}/mes${pct.padStart(8)}`);
}

if (target) {
  writeFileSync(target, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  console.log(`\nescrito en ${target}`);
}
