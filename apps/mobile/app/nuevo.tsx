/** Alta manual de un movimiento. */

import { listarCuentas, crearMovimiento } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FormularioMovimiento, type ValoresDelFormulario } from '../components/FormularioMovimiento';
import { useAvisar } from '../datos/aviso';
import { useDatos } from '../datos/BaseDeDatos';
import { useCuentaActiva } from '../datos/cuenta';
import { useTema } from '../datos/tema';
import { volver } from '../datos/navegacion';
import { PantallaModal } from '../components/PantallaModal';

export default function NuevoMovimiento() {
  const { theme } = useTema();

  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const { cuentaId } = useCuentaActiva();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDelFormulario) {
    try {
      // A la cuenta que se esta mirando. Antes iba **siempre a la primera**, asi
      // que con dos cuentas todo caia en la misma sin preguntar. Con el alcance
      // en "todas" no hay una elegida y se usa la primera, que es lo unico
      // razonable que queda.
      const cuentas = listarCuentas(db, contexto);
      const cuenta = cuentas.find((c) => c.id === cuentaId) ?? cuentas[0];
      if (!cuenta) {
        setError('No hay ninguna cuenta creada todavia');
        return;
      }
      crearMovimiento(db, contexto, { cuentaId: cuenta.id, ...valores });
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
