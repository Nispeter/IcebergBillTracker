/**
 * Los datos de prueba, ahora **a pedido**.
 *
 * Antes se sembraban solos la primera vez que arrancaba la app. Estaba bien
 * mientras el proyecto era una demo, y deja de estarlo en cuanto alguien quiere
 * usarla con su plata: abrir la app y encontrar dieciocho meses de gasto chileno
 * inventado, mezclado con lo propio, no hay forma de arreglarlo salvo borrando.
 *
 * Ahora la base arranca vacia con una cuenta y nada mas, y esto se llama desde
 * Ajustes cuando alguien quiere ver la app con datos.
 */

import type { dates } from '@iceberg/core';
import {
  crearCuenta, crearMovimiento, editarCuenta, listarCuentas,
  type BaseDeDatos as Base, type Contexto,
} from '@iceberg/db';
import { generateSeed } from '@iceberg/seed';

/**
 * Vuelca el dataset de prueba.
 *
 * Entra por los mismos repositorios que usa la app, no por SQL crudo: asi los
 * datos de prueba pasan por las mismas validaciones que un movimiento escrito a
 * mano, y si alguna estuviera mal, se nota aca y no en produccion.
 *
 * Todo en una transaccion: si una validacion falla a mitad de los 679
 * movimientos, sin esto quedarian escritos los anteriores y la base a medio
 * llenar, que es peor que no haber empezado.
 */
export function cargarSemilla(db: Base, contexto: Contexto): number {
  const dataset = generateSeed();
  const existente = listarCuentas(db, contexto)[0];

  db.transaction((tx) => {
    const base = tx as unknown as Base;
    // Se reutiliza la cuenta que el arranque creo vacia, en vez de sumar una
    // segunda: dos cuentas identicas confundirian el saldo sin avisar. Se le
    // pone el saldo inicial del dataset, o los 679 movimientos arrancarian
    // desde cero y el saldo quedaria negativo desde el primer mes.
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
