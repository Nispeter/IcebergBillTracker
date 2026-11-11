/** Editar o borrar un movimiento. */

import type { dates } from '@iceberg/core';
import { borrarMovimiento, editarMovimiento, obtenerMovimiento } from '@iceberg/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { NoExiste } from '../../components/Formulario';
import { FormularioMovimiento, type ValoresDelFormulario } from '../../components/FormularioMovimiento';
import { PantallaModal } from '../../components/PantallaModal';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';

export default function EditarMovimiento() {
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  // Se lee una sola vez: el formulario es un borrador, no una vista viva de la
  // base, o cada tecla se pisaría con el valor guardado.
  const movimiento = useMemo(
    () => (id ? obtenerMovimiento(db, contexto, id) : null),
    [db, contexto, id],
  );

  if (!movimiento) {
    return (
      <PantallaModal>
        <NoExiste mensaje="Ese movimiento ya no existe" />
      </PantallaModal>
    );
  }

  function guardar(valores: ValoresDelFormulario) {
    try {
      // Sin cuenta (no queda ninguna) se deja la que ya tenía: `editarMovimiento`
      // ignora lo que llega `undefined`.
      const { cuentaId, ...resto } = valores;
      editarMovimiento(db, contexto, movimiento!.id, { ...resto, cuentaId: cuentaId ?? undefined });
      avisar('Cambios guardados');
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function borrar() {
    try {
      borrarMovimiento(db, contexto, movimiento!.id);
      avisar('Movimiento borrado');
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <FormularioMovimiento
        titulo="Editar movimiento"
        inicial={{
          tipo: movimiento.tipo,
          montoMinor: movimiento.montoMinor,
          ocurridoEn: movimiento.ocurridoEn as dates.PlainDate,
          nombre: movimiento.nombre,
          categoriaId: movimiento.categoriaId,
          // La columna guarda 0, 1 o nulo; el formulario habla en booleanos.
          comprometido: movimiento.comprometido === null ? null : movimiento.comprometido === 1,
          cuentaId: movimiento.cuentaId,
        }}
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        onBorrar={borrar}
        error={error}
      />
    </PantallaModal>
  );
}
