/** Alta manual de un movimiento. */

import { crearMovimiento } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FormularioMovimiento, type ValoresDelFormulario } from '../components/FormularioMovimiento';
import { PantallaModal } from '../components/PantallaModal';
import { useAvisar } from '../datos/aviso';
import { useDatos } from '../datos/BaseDeDatos';
import { volver } from '../datos/navegacion';

export default function NuevoMovimiento() {
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDelFormulario) {
    try {
      const { cuentaId, ...resto } = valores;
      if (cuentaId === null) {
        setError('No hay ninguna cuenta creada todavía.');
        return;
      }
      crearMovimiento(db, contexto, { cuentaId, ...resto });
      avisar('Movimiento guardado');
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <FormularioMovimiento
        titulo="Nuevo movimiento"
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        error={error}
      />
    </PantallaModal>
  );
}
