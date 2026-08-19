/**
 * Contexto de escritura: quien escribe, desde donde, y con que reloj.
 *
 * Toda escritura necesita estos datos para llenar las columnas de sync. En vez
 * de pasarlos sueltos por cada funcion —y arriesgar que alguna se olvide de
 * poner el `household_id`— van juntos en un objeto que los repositorios exigen.
 *
 * El reloj vive **aca adentro**, no en un global: dos tests pueden correr en
 * paralelo con relojes distintos, y un test puede fijar la hora sin tocar el
 * reloj del sistema.
 */

import { sync } from '@iceberg/core';
import { monotonicFactory } from 'ulid';

export interface Contexto {
  readonly householdId: string;
  /** Dispositivo que escribe. Sin guiones: es parte del formato del HLC. */
  readonly deviceId: string;
  /** Miembro del hogar que escribe. */
  readonly memberId: string;
  /** Devuelve el HLC de ahora, en texto, y avanza el reloj. */
  ahora(): string;
  /** Un id nuevo, ordenable por tiempo de creacion. */
  nuevoId(): string;
}

export interface OpcionesDeContexto {
  readonly householdId: string;
  readonly deviceId: string;
  readonly memberId: string;
  /** Reloj de pared. Se inyecta para poder fijar la hora en los tests. */
  readonly reloj?: () => number;
  /** Generador de ids. Se inyecta para poder hacerlo determinista en tests. */
  readonly generarId?: () => string;
}

export function crearContexto(opciones: OpcionesDeContexto): Contexto {
  const reloj = opciones.reloj ?? Date.now;
  // `monotonicFactory` garantiza que dos ids pedidos en el mismo milisegundo
  // salgan en orden creciente, en vez de arriesgar una colision.
  const ulid = opciones.generarId ?? monotonicFactory();

  let ultimo: sync.Hlc | null = null;

  return {
    householdId: opciones.householdId,
    deviceId: opciones.deviceId,
    memberId: opciones.memberId,
    ahora() {
      ultimo = sync.hlcNow(ultimo, opciones.deviceId, reloj());
      return sync.hlcToString(ultimo);
    },
    nuevoId: () => ulid(),
  };
}

/** Las columnas de sync de una fila nueva. */
export function columnasNuevas(contexto: Contexto) {
  const ahora = contexto.ahora();
  return {
    id: contexto.nuevoId(),
    householdId: contexto.householdId,
    createdBy: contexto.memberId,
    createdAt: ahora,
    updatedAt: ahora,
    deletedAt: null,
    originDeviceId: contexto.deviceId,
  };
}

/** Las columnas de sync que cambian al editar. El `createdAt` no se toca. */
export function columnasEditadas(contexto: Contexto) {
  return {
    updatedAt: contexto.ahora(),
    originDeviceId: contexto.deviceId,
  };
}
