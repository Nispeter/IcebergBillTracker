/** Alta manual de un movimiento. */

import { listarCuentas, crearMovimiento } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FormularioMovimiento, type ValoresDelFormulario } from '../components/FormularioMovimiento';
import { useDatos } from '../datos/BaseDeDatos';
import { useTema } from '../datos/tema';
import { volver } from '../datos/navegacion';
import { PantallaModal } from '../components/PantallaModal';

export default function NuevoMovimiento() {
  const { theme } = useTema();

  const { db, contexto } = useDatos();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDelFormulario) {
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) {
        setError('No hay ninguna cuenta creada todavia');
        return;
      }
      crearMovimiento(db, contexto, { cuentaId: cuenta.id, ...valores });
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <FormularioMovimiento
        theme={theme}
        titulo="Nuevo movimiento"
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        error={error}
      />
    </PantallaModal>
  );
}
