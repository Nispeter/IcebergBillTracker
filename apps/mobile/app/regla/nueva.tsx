/** Alta de una cuenta periodica. */

import { crearRegla, listarCuentas } from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FormularioRegla, type ValoresDeRegla } from '../../components/FormularioRegla';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';
import { useTema } from '../../datos/tema';
import { PantallaModal } from '../../components/PantallaModal';

export default function NuevaRegla() {
  const { theme } = useTema();
  const { db, contexto } = useDatos();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function guardar(valores: ValoresDeRegla) {
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) {
        setError('No hay ninguna cuenta creada todavia');
        return;
      }
      crearRegla(db, contexto, { cuentaId: cuenta.id, ...valores });
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <FormularioRegla
        theme={theme}
        titulo="Nueva cuenta periódica"
        onGuardar={guardar}
        onCancelar={() => volver(router)}
        error={error}
      />
    </PantallaModal>
  );
}
