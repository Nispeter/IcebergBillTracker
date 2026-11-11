/**
 * Lo que hay guardado en este teléfono y cómo se identifica. Solo lectura: sirve
 * para entender un saldo que no cuadra o depurar entre dos teléfonos.
 */

import { money } from '@iceberg/core';
import { CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO, leerAjuste } from '@iceberg/db';
import { useMemo } from 'react';
import { Dato, Panel } from '../Panel';
import { Seccion } from './comun';
import { useDatos } from '../../datos/BaseDeDatos';
import { useCuentas, useMovimientos, useSaldo, useSaldoInicial } from '../../datos/consultas';

/**
 * Las últimas letras de un identificador. Son ULID: empiezan por la hora de
 * creación, y los tres de este teléfono se crearon en el mismo instante, así
 * que lo que los distingue es el final.
 */
function cola(id: string | null): string {
  return id === null || id === '' ? '—' : `…${id.slice(-6)}`;
}

export function EsteTelefono() {
  const { db } = useDatos();
  const movimientos = useMovimientos();
  const cuentas = useCuentas();
  const saldo = useSaldo(useSaldoInicial());
  const ids = useMemo(() => ({
    dispositivo: leerAjuste(db, CLAVE_DISPOSITIVO),
    hogar: leerAjuste(db, CLAVE_HOGAR),
    miembro: leerAjuste(db, CLAVE_MIEMBRO),
  }), [db]);

  return (
    <Seccion
      titulo="Este teléfono"
      ayuda={'Cuánto hay guardado acá. El saldo sale del saldo inicial de las cuentas más '
        + 'todo lo que entró menos todo lo que salió, y por eso no cuadra con el banco '
        + 'si no pusiste el saldo inicial.\n\n'
        + 'Los identificadores se crean una sola vez y no cambian. Se muestran solo las '
        + 'últimas letras, que es lo que los distingue: los tres se crearon en el mismo '
        + 'instante y empiezan igual. El código de hogar completo, el que se comparte, '
        + 'está en Sincronizar.'}
    >
      <Panel>
        <Dato etiqueta="Movimientos" valor={String(movimientos.length)} />
        <Dato etiqueta="Cuentas" valor={String(cuentas.length)} />
        <Dato etiqueta="Saldo" valor={money.format(saldo)} />
        <Dato etiqueta="Dispositivo" valor={cola(ids.dispositivo)} />
        <Dato etiqueta="Hogar" valor={cola(ids.hogar)} />
        <Dato etiqueta="Miembro" valor={cola(ids.miembro)} />
      </Panel>
    </Seccion>
  );
}
