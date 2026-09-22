/** Alta manual de un movimiento. */

import { crearMovimiento } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FormularioMovimiento, type ValoresDelFormulario } from '../components/FormularioMovimiento';
import { useAvisar } from '../datos/aviso';
import { useDatos } from '../datos/BaseDeDatos';
import { useTema } from '../datos/tema';
import { volver } from '../datos/navegacion';
import { PantallaModal } from '../components/PantallaModal';

export default function NuevoMovimiento() {
  const { theme } = useTema();

  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDelFormulario) {
    try {
      // A que cuenta va lo decide el formulario: arranca con la que se esta
      // mirando y se puede cambiar ahi mismo. Antes se resolvia aca, a ciegas y
      // sin forma de corregirlo.
      const { cuentaId, ...resto } = valores;
      if (cuentaId === null) {
        setError('No hay ninguna cuenta creada todavia');
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
        theme={theme}
        titulo="Nuevo movimiento"
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        error={error}
      />
    </PantallaModal>
  );
}
