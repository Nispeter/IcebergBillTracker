/**
 * Los datos de prueba, a pedido desde Ajustes: la base arranca vacía, y datos
 * inventados mezclados con los propios no se pueden separar después.
 */

import type { dates } from '@iceberg/core';
import {
  crearCuenta, crearMovimiento, editarCuenta, listarCuentas,
  type BaseDeDatos as Base, type Contexto,
} from '@iceberg/db';
import { generateSeed } from '@iceberg/seed';

/**
 * Vuelca el dataset por los mismos repositorios que usa la app, para que pase
 * por las mismas validaciones, y en una transacción, para no dejar la base a
 * medio llenar si alguna falla.
 */
export function cargarSemilla(db: Base, contexto: Contexto): number {
  const dataset = generateSeed();
  const existente = listarCuentas(db, contexto)[0];

  db.transaction((tx) => {
    const base = tx as unknown as Base;
    // Se reutiliza la cuenta vacía del arranque (dos idénticas confundirían el
    // saldo) con el saldo inicial del dataset, o quedaría negativo desde el inicio.
    const cuenta = existente ?? crearCuenta(base, contexto, {
      nombre: 'Cuenta corriente',
      tipo: 'corriente',
      saldoInicialMinor: dataset.saldoInicialMinor,
    });
    if (existente !== undefined) {
      editarCuenta(base, contexto, cuenta.id, { saldoInicialMinor: dataset.saldoInicialMinor });
    }

    for (const movimiento of dataset.transactions) {
      crearMovimiento(base, contexto, {
        cuentaId: cuenta.id,
        tipo: movimiento.type,
        montoMinor: movimiento.amountMinor,
        ocurridoEn: movimiento.occurredAt as dates.PlainDate,
        nombre: movimiento.name,
        categoriaId: movimiento.category ?? null,
      });
    }
  });

  return dataset.transactions.length;
}
