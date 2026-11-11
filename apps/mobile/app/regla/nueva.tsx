/** Alta de una cuenta periódica. */

import { crearRegla, listarCuentas } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FormularioRegla, type ValoresDeRegla } from '../../components/FormularioRegla';
import { PantallaModal } from '../../components/PantallaModal';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';

export default function NuevaRegla() {
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDeRegla) {
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) {
        setError('No hay ninguna cuenta creada todavía.');
        return;
      }
      crearRegla(db, contexto, { cuentaId: cuenta.id, ...valores });
      avisar('Cuenta periódica guardada');
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <FormularioRegla
        titulo="Nueva cuenta periódica"
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        error={error}
      />
    </PantallaModal>
  );
}
